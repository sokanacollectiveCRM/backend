# shellcheck shell=bash

dev_env_log() {
  printf '%s\n' "$*"
}

dev_env_die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

dev_env_require_cmd() {
  local name="$1"
  command -v "${name}" >/dev/null 2>&1 || \
    dev_env_die "Missing ${name}. Install it, then retry."
}

dev_env_connection_name() {
  local instance="$1"
  printf '%s:%s:%s' "${PROJECT_ID}" "${REGION}" "${instance}"
}

dev_env_assert_isolated_target() {
  if [[ "${DEV_INSTANCE}" == "${PROD_INSTANCE}" ]]; then
    dev_env_die "DEV_INSTANCE cannot be production instance ${PROD_INSTANCE}"
  fi
  if [[ "${DEV_INSTANCE}" != *"-dev" ]]; then
    dev_env_die "DEV_INSTANCE must contain '-dev' (got ${DEV_INSTANCE})"
  fi
  if [[ "${DEV_SERVICE}" == "${PROD_SERVICE}" ]]; then
    dev_env_die "DEV_SERVICE cannot be production service ${PROD_SERVICE}"
  fi
  if [[ "${DEV_SERVICE}" != *"-dev" ]]; then
    dev_env_die "DEV_SERVICE must contain '-dev' (got ${DEV_SERVICE})"
  fi
  if [[ "${DEV_DATABASE}" == "${PROD_DATABASE}" ]]; then
    dev_env_die "DEV_DATABASE cannot be production database ${PROD_DATABASE}"
  fi
}

dev_env_load_env_file() {
  local file="$1"
  [[ -f "${file}" ]] || return 1
  set -a
  # shellcheck disable=SC1090
  source "${file}"
  set +a
}

dev_env_mkdir_local() {
  mkdir -p "${LOCAL_DIR}"
  chmod 700 "${LOCAL_DIR}"
}

dev_env_random_secret() {
  openssl rand -base64 32 | tr -d '\n'
}

dev_env_write_kv() {
  local file="$1"
  local key="$2"
  local value="$3"
  touch "${file}"
  chmod 600 "${file}"
  if grep -q "^${key}=" "${file}" 2>/dev/null; then
    local escaped
    escaped="$(printf '%s' "${value}" | sed -e 's/[\/&]/\\&/g')"
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s/^${key}=.*/${key}=${escaped}/" "${file}"
    else
      sed -i "s/^${key}=.*/${key}=${escaped}/" "${file}"
    fi
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${file}"
  fi
}

dev_env_read_kv() {
  local file="$1"
  local key="$2"
  [[ -f "${file}" ]] || return 1
  grep -E "^${key}=" "${file}" | tail -n1 | cut -d= -f2-
}

dev_env_wait_for_port() {
  local host="$1"
  local port="$2"
  local attempts="${3:-30}"
  local i
  for ((i = 1; i <= attempts; i++)); do
    if nc -z "${host}" "${port}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

dev_env_proxy_bin() {
  if command -v cloud-sql-proxy >/dev/null 2>&1; then
    printf 'cloud-sql-proxy'
    return 0
  fi
  if command -v cloud_sql_proxy >/dev/null 2>&1; then
    printf 'cloud_sql_proxy'
    return 0
  fi
  return 1
}

dev_env_start_proxy() {
  local instance="$1"
  local port="$2"
  local connection
  connection="$(dev_env_connection_name "${instance}")"
  local bin
  bin="$(dev_env_proxy_bin)" || \
    dev_env_die "Missing cloud-sql-proxy. Install with: brew install cloud-sql-proxy"
  if nc -z "${PROXY_ADDRESS}" "${port}" >/dev/null 2>&1; then
    dev_env_log "Reusing existing listener on ${PROXY_ADDRESS}:${port}"
    return 0
  fi
  "${bin}" "${connection}" --address "${PROXY_ADDRESS}" --port "${port}" \
    >/tmp/sokana-proxy-"${port}".log 2>&1 &
  local pid=$!
  PROXY_PIDS+=("${pid}")
  if ! dev_env_wait_for_port "${PROXY_ADDRESS}" "${port}" 45; then
    dev_env_die "Cloud SQL Proxy did not listen on ${PROXY_ADDRESS}:${port}. See /tmp/sokana-proxy-${port}.log"
  fi
  dev_env_log "Proxy for ${connection} listening on ${PROXY_ADDRESS}:${port} (pid ${pid})"
}

dev_env_stop_proxies() {
  if [[ "${DEV_ENV_KEEP_PROXIES:-}" == "1" ]]; then
    return 0
  fi
  local pid
  for pid in "${PROXY_PIDS[@]:-}"; do
    if [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1; then
      kill "${pid}" >/dev/null 2>&1 || true
    fi
  done
}

dev_env_assert_schema_only_dump() {
  local file="$1"
  [[ -s "${file}" ]] || dev_env_die "Schema dump is empty: ${file}"
  if grep -E '^COPY .+ FROM stdin;' "${file}" >/dev/null 2>&1; then
    dev_env_die "Refusing dump that contains COPY data: ${file}"
  fi
}

dev_env_confirm() {
  local prompt="$1"
  if [[ "${DEV_ENV_YES:-}" == "1" ]]; then
    return 0
  fi
  local reply
  printf '%s [y/N] ' "${prompt}"
  read -r reply
  [[ "${reply}" == "y" || "${reply}" == "Y" ]]
}

PROXY_PIDS=()
trap dev_env_stop_proxies EXIT
