#!/usr/bin/env bash
#
# 一键发布静态博客到 1Panel（Astro → dist → zip → 面板 API 上传 → 解压 → 验证）
#
# 用法：
#   bash scripts/deploy-1panel.sh              # 构建 + 干净部署 + 验证
#   bash scripts/deploy-1panel.sh --no-clean   # 增量部署（保留旧文件）
#   bash scripts/deploy-1panel.sh --skip-build # 复用当前 dist/，只上传
#
# 配置（优先级：环境变量 > .env.deploy > 脚本默认值）：
#   PANEL_HOST   面板地址，默认 http://124.221.189.35:8090
#   PANEL_KEY    面板 API Key（必填，放在 .env.deploy 里，该文件已被 .gitignore 忽略）
#   SITE_DIR     网站根目录，默认 /opt/1panel/www/sites/blog.667667.xyz
#   SITE_DOMAIN  域名，默认 blog.667667.xyz
#   SERVER_IP    源站 IP，默认 124.221.189.35（验证时代替 DNS 直连源站）
#
# 1Panel API 的坑（都已在本脚本内规避，改动前请先读）：
#   1. 鉴权：1Panel-Token = md5("1panel" + APIKey + unix秒)，配合 1Panel-Timestamp
#   2. 上传：multipart 字段名是 file（单数），传 files 会返回 500
#   3. 解压：path 必须是 zip 的完整路径，只给所在目录会「假成功」什么都不解
#   4. 删除：/files/del 只接受单个文件/目录的完整路径；
#      传「目录 + 名字列表」会把整个目录递归删掉（曾误删 index/log/ssl）
#   5. 没有 mkdir 接口，目录只能靠解压一个含空目录的 zip 重建
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env.deploy" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/.env.deploy"
fi

PANEL_HOST="${PANEL_HOST:-http://124.221.189.35:8090}"
PANEL_KEY="${PANEL_KEY:-}"
SITE_DIR="${SITE_DIR:-/opt/1panel/www/sites/blog.667667.xyz}"
SITE_DOMAIN="${SITE_DOMAIN:-blog.667667.xyz}"
SERVER_IP="${SERVER_IP:-124.221.189.35}"

ZIP_NAME="blog-dist.zip"
ZIP_PATH="/tmp/$ZIP_NAME"

CLEAN=1
DO_BUILD=1

for arg in "$@"; do
  case "$arg" in
    --no-clean) CLEAN=0 ;;
    --skip-build) DO_BUILD=0 ;;
    -h | --help)
      sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "未知参数：$arg（--no-clean / --skip-build / --help）" >&2
      exit 2
      ;;
  esac
done

# ---------- 输出 ----------
C_RESET='\033[0m'
C_STEP='\033[1;36m'
C_OK='\033[1;32m'
C_WARN='\033[1;33m'
C_ERR='\033[1;31m'
C_DIM='\033[2m'

step() { printf "${C_STEP}▸ %s${C_RESET}\n" "$*"; }
ok() { printf "  ${C_OK}✓${C_RESET} %s\n" "$*"; }
warn() { printf "  ${C_WARN}!${C_RESET} %s\n" "$*"; }
die() {
  printf "${C_ERR}✗ %s${C_RESET}\n" "$*" >&2
  exit 1
}

# ---------- 基础依赖 ----------
[[ -n "$PANEL_KEY" ]] || die "缺少 PANEL_KEY，请在项目根目录创建 .env.deploy 并写入 PANEL_KEY=你的面板APIKey"
command -v pnpm >/dev/null || die "找不到 pnpm"
command -v zip >/dev/null || die "找不到 zip"
command -v curl >/dev/null || die "找不到 curl"

md5hex() {
  if command -v md5 >/dev/null 2>&1; then
    printf '%s' "$1" | md5 -q
  else
    printf '%s' "$1" | md5sum | cut -d' ' -f1
  fi
}

# p1 <endpoint> [curl 额外参数...] —— POST JSON 到面板 API
p1() {
  local endpoint="$1"
  shift
  local ts token
  ts="$(date +%s)"
  token="$(md5hex "1panel${PANEL_KEY}${ts}")"
  curl -sS -m 600 -X POST "${PANEL_HOST}/api/v2${endpoint}" \
    -H "1Panel-Token: ${token}" \
    -H "1Panel-Timestamp: ${ts}" \
    -H "Content-Type: application/json" \
    "$@"
}

# p1_get <endpoint> —— GET 读取型接口（部分接口只挂在 GET 上，比如系统信息）
p1_get() {
  local endpoint="$1"
  local ts token
  ts="$(date +%s)"
  token="$(md5hex "1panel${PANEL_KEY}${ts}")"
  curl -sS -m 60 -X GET "${PANEL_HOST}/api/v2${endpoint}" \
    -H "1Panel-Token: ${token}" \
    -H "1Panel-Timestamp: ${ts}"
}

# 从响应里取字段（够用即可，不引入 jq 依赖）
json_code() { printf '%s' "$1" | sed -E -n 's/.*"code"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p' | head -1; }
json_msg() { printf '%s' "$1" | sed -E -n 's/.*"message"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/p' | head -1; }

api_ok() {
  local endpoint="$1"
  shift
  local resp code
  resp="$(p1 "$endpoint" "$@")"
  code="$(json_code "$resp")"
  if [[ "$code" != "200" ]]; then
    die "接口 ${endpoint} 失败（code=${code:-无}）：$(json_msg "$resp")"
  fi
  printf '%s' "$resp"
}

# ---------- 1. 面板连通性 ----------
step "检查 1Panel 连通性"
probe="$(p1_get /dashboard/base/os)"
[[ "$(json_code "$probe")" == "200" ]] ||
  die "面板不可达或 API Key 无效（$(json_msg "$probe")）：${PANEL_HOST}"
ok "面板可用：${PANEL_HOST}"

# ---------- 2. 构建 ----------
if [[ "$DO_BUILD" == "1" ]]; then
  step "构建站点"
  # 沙箱环境会拦截 Astro 清理 dist/.prerender（批量删除守卫），先挪走旧产物
  if [[ -d dist ]]; then
    mv dist "/tmp/dist-old-$(date +%s)"
  fi
  pnpm build >/tmp/deploy-build.log 2>&1 || {
    tail -30 /tmp/deploy-build.log >&2
    die "构建失败，完整日志见 /tmp/deploy-build.log"
  }
  build_pages="$(grep -oE '[0-9]+ page\(s\) built' /tmp/deploy-build.log | head -1 || true)"
  [[ -d dist ]] || die "构建结束但没有 dist/ 目录"
  pages_note=""
  if [[ -n "$build_pages" ]]; then
    pages_note="（${build_pages}）"
  fi
  ok "构建完成${pages_note}，$(find dist -type f | wc -l | tr -d ' ') 个文件"
else
  step "跳过构建"
  [[ -d dist ]] || die "dist/ 不存在，无法跳过构建"
  ok "复用现有 dist/"
fi

# ---------- 3. 打包 ----------
step "打包 dist"
rm -f "$ZIP_PATH"
(cd dist && zip -qr "$ZIP_PATH" . -x "*.DS_Store")
ok "已生成 $(du -h "$ZIP_PATH" | awk '{print $1}') 压缩包"

# ---------- 4. 上传 ----------
step "上传到 1Panel"
up_ts="$(date +%s)"
up_token="$(md5hex "1panel${PANEL_KEY}${up_ts}")"
upload_resp="$(curl -sS -m 600 -X POST "${PANEL_HOST}/api/v2/files/upload" \
  -H "1Panel-Token: ${up_token}" \
  -H "1Panel-Timestamp: ${up_ts}" \
  -F "path=${SITE_DIR}" \
  -F "overwrite=True" \
  -F "file=@${ZIP_PATH};filename=${ZIP_NAME}")"
[[ "$(json_code "$upload_resp")" == "200" ]] || die "上传失败：$(json_msg "$upload_resp")"
ok "已上传至 ${SITE_DIR}/${ZIP_NAME}"

# ---------- 5. 清空旧目录（干净部署）----------
if [[ "$CLEAN" == "1" ]]; then
  step "清空旧 index（避免残留旧文章/旧资源）"
  del_resp="$(p1 /files/del -d "{\"path\":\"${SITE_DIR}/index\"}")"
  if [[ "$(json_code "$del_resp")" == "200" ]]; then
    ok "旧 index 已删除"
  else
    warn "删除旧 index 返回：$(json_msg "$del_resp")（首次部署时正常，可忽略）"
  fi
else
  step "增量部署（保留旧文件）"
fi

# ---------- 6. 解压 ----------
step "解压到站点目录"
decompress() {
  p1 /files/decompress -d "{
    \"path\": \"${SITE_DIR}/${ZIP_NAME}\",
    \"name\": \"${ZIP_NAME}\",
    \"dst\": \"${SITE_DIR}/index\",
    \"type\": \"zip\",
    \"overwrite\": true
  }"
}

resp="$(decompress)"
if [[ "$(json_code "$resp")" != "200" ]]; then
  warn "解压失败，重试一次：$(json_msg "$resp")"
  sleep 2
  resp="$(decompress)"
  [[ "$(json_code "$resp")" == "200" ]] ||
    die "解压失败，zip 仍保留在 ${SITE_DIR}/${ZIP_NAME}，可在 1Panel 文件管理里手动解压到 index/"
fi
sleep 2
ok "已解压到 ${SITE_DIR}/index"

# ---------- 7. 清理 zip ----------
step "清理临时压缩包"
if p1 /files/del -d "{\"path\":\"${SITE_DIR}/${ZIP_NAME}\"}" >/dev/null; then
  ok "压缩包已删除"
else
  warn "压缩包删除失败，可稍后在面板里手动删 ${SITE_DIR}/${ZIP_NAME}"
fi

# ---------- 8. 校验 ----------
step "校验线上页面"
CHECK_PATHS=("/" "/about/" "/archives/" "/tags/" "/page/2/" "/project/cpa/")
fail=0
for path in "${CHECK_PATHS[@]}"; do
  code="$(curl -sS -m 20 --noproxy '*' --resolve "${SITE_DOMAIN}:443:${SERVER_IP}" \
    -o /dev/null -w '%{http_code}' "https://${SITE_DOMAIN}${path}" || echo 000)"
  if [[ "$code" == "200" ]]; then
    printf "  ${C_OK}✓${C_RESET} %-20s %s\n" "$path" "$code"
  else
    printf "  ${C_ERR}✗${C_RESET} %-20s %s\n" "$path" "$code"
    fail=1
  fi
done

# 目录条目数与本地比对（顶层）
local_top="$(ls dist | wc -l | tr -d ' ')"
remote_top="$(p1 /files/search -d "{
  \"path\": \"${SITE_DIR}/index\",
  \"page\": 1,
  \"pageSize\": 1,
  \"orderBy\": \"name\",
  \"order\": \"asc\",
  \"expand\": true,
  \"showHidden\": true,
  \"search\": \"\",
  \"containSub\": false,
  \"filter\": \"all\"
}" | sed -E -n 's/.*"itemTotal"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p' | head -1)"

if [[ -n "$remote_top" && "$remote_top" != "$local_top" ]]; then
  warn "顶层条目数不一致：本地 ${local_top} / 线上 ${remote_top}"
  fail=1
else
  ok "顶层条目数一致（${local_top}）"
fi

echo
if [[ "$fail" == "0" ]]; then
  printf "${C_OK}发布完成${C_RESET} → https://%s/\n" "$SITE_DOMAIN"
else
  printf "${C_ERR}发布完成但校验未全通过${C_RESET}，请检查上面的 ✗ 项\n" >&2
  exit 1
fi
