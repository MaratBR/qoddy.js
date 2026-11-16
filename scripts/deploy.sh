#!/usr/bin/env bash
# Deploys Qoddy to a host over SSH as a Docker container that starts with the machine.
#
# Usage: scripts/deploy.sh [--build local|remote] [--port 3040] [--domain qoddy.example] <[user@]host>
#
#   --build local    build the image here and send it to the host (docker save | docker load)
#   --build remote   send this folder as a .tar.gz and build the image on the host
#                    (asked interactively when not given)
#   --port           the host port the app listens on (default 3040), plain HTTP
#   --domain         the public name: sets ORIGIN=https://<domain>. HTTPS and its certificate
#                    are the upstream proxy's job; point it at <host>:<port>.
#                    Remembered for later deploys.
#
# Nothing is seeded: a new database starts empty apart from the schema. When it has
# no accounts yet, the script asks for the first admin's email, name and password.
#
# On the host everything lives in ~/qoddy-deployment:
#   qoddy.env   environment for the app container, created on the first deploy.
#               ORIGIN is set from --domain; or set it here yourself.
#   domain.env  the remembered domain
#   src/        the uploaded source (--build remote only)
# The database is in the Docker volume `qoddy-data`, kept across deploys.
# The container runs with --restart unless-stopped, so it comes back after a reboot
# as long as the Docker service starts at boot.
set -euo pipefail

NAME=qoddy
IMAGE=qoddy:latest
DIR=qoddy-deployment # relative to the remote home
PORT=3040
BUILD=
DOMAIN=
HOST=

usage() {
	sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'
	exit "${1:-0}"
}
die() {
	echo "deploy: $*" >&2
	exit 1
}

while [ $# -gt 0 ]; do
	case "$1" in
		--build) BUILD="${2:-}"; shift 2 ;;
		--port) PORT="${2:-}"; shift 2 ;;
		--domain) DOMAIN="${2:-}"; shift 2 ;;
		-h | --help) usage ;;
		-*) die "unknown option $1" ;;
		*) [ -z "$HOST" ] || die "only one host"; HOST="$1"; shift ;;
	esac
done
[ -n "$HOST" ] || usage 1
[[ "$PORT" =~ ^[0-9]+$ ]] && [ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ] || die "bad port: $PORT"
[ -z "$DOMAIN" ] || [[ "$DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || die "bad domain: $DOMAIN"

if [ -z "$BUILD" ]; then
	[ -t 0 ] || die "--build local|remote is required when not run interactively"
	echo "Where should the image be built?"
	select choice in "local: build here, send the image" "remote: send the source, build on $HOST"; do
		case "$REPLY" in 1) BUILD=local; break ;; 2) BUILD=remote; break ;; esac
	done
fi
case "$BUILD" in local | remote) ;; *) die "--build must be local or remote" ;; esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# One SSH connection for every step, so a password or key prompt comes up once.
CONTROL="$(mktemp -d)"
trap 'ssh -o ControlPath="$CONTROL/s" -O exit "$HOST" 2>/dev/null || true; rm -rf "$CONTROL"' EXIT
SSH=(ssh -o ControlMaster=auto -o ControlPath="$CONTROL/s" -o ControlPersist=120 "$HOST")

echo "==> Checking Docker on $HOST"
ARCH="$("${SSH[@]}" '
	command -v docker >/dev/null 2>&1 || { echo "Docker is not installed" >&2; exit 1; }
	docker info --format "{{.Architecture}}" 2>/dev/null || { echo "Docker is installed but not usable by $(id -un) (is the daemon running, is the user in the docker group?)" >&2; exit 1; }
')" || die "no usable Docker on $HOST"
case "$ARCH" in
	x86_64 | amd64) PLATFORM=linux/amd64 ;;
	aarch64 | arm64) PLATFORM=linux/arm64 ;;
	*) die "unsupported architecture on $HOST: $ARCH" ;;
esac

"${SSH[@]}" "mkdir -p ~/$DIR && touch ~/$DIR/qoddy.env"

if [ "$BUILD" = local ]; then
	command -v docker >/dev/null 2>&1 || die "Docker is not installed here"
	echo "==> Building $IMAGE here for $PLATFORM"
	docker build --platform "$PLATFORM" -t "$IMAGE" "$ROOT"
	echo "==> Sending the image to $HOST"
	docker save "$IMAGE" | gzip | "${SSH[@]}" 'gunzip | docker load'
else
	echo "==> Sending the source to $HOST:~/$DIR/src"
	tar -C "$ROOT" -czf - \
		--exclude=./.git --exclude=./.claude --exclude=./.svelte-kit --exclude=./.playwright-mcp \
		--exclude=./node_modules --exclude=./build --exclude=./fixtures \
		--exclude='*.db' --exclude='*.db-shm' --exclude='*.db-wal' \
		--exclude=./.env --exclude='./.env.*' \
		. | "${SSH[@]}" "rm -rf ~/$DIR/src && mkdir ~/$DIR/src && tar -xzf - -C ~/$DIR/src"
	echo "==> Building $IMAGE on $HOST"
	"${SSH[@]}" "docker build -t $IMAGE ~/$DIR/src"
fi

echo "==> Starting $NAME"
# Quoted, because ssh joins the arguments into one command line and empty ones would vanish.
"${SSH[@]}" "bash -s -- $(printf '%q ' "$NAME" "$IMAGE" "$DIR" "$PORT" "$DOMAIN")" <<'REMOTE'
set -eu
NAME=$1 IMAGE=$2 DIR=$3 PORT=$4 DOMAIN=$5
D=$HOME/$DIR

if [ -n "$DOMAIN" ]; then
	printf 'DOMAIN=%s\n' "$DOMAIN" >"$D/domain.env"
elif [ -f "$D/domain.env" ]; then
	. "$D/domain.env"
fi
if [ -n "$DOMAIN" ]; then set -- -e "ORIGIN=https://$DOMAIN"; else set --; fi

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --restart unless-stopped \
	-p "$PORT:3000" -v qoddy-data:/data --env-file "$D/qoddy.env" "$@" \
	"$IMAGE" >/dev/null
sleep 3
if [ "$(docker inspect -f '{{.State.Running}}' "$NAME")" != true ]; then
	echo "The app container did not stay up. Its log:" >&2
	docker logs --tail 50 "$NAME" >&2
	exit 1
fi

if command -v systemctl >/dev/null 2>&1 && ! systemctl is-enabled docker >/dev/null 2>&1; then
	echo "Warning: the docker service is not enabled at boot, so Qoddy will not start after a reboot." >&2
	echo "         Run on the host: sudo systemctl enable docker" >&2
fi
[ -n "$DOMAIN" ] || grep -q '^ORIGIN=' "$D/qoddy.env" ||
	echo "Note: no --domain and no ORIGIN in ~/$DIR/qoddy.env: fine on plain localhost, otherwise sign-in and sync writes fail."
REMOTE

# The first admin, for a database without accounts. The password goes over stdin, never
# on a command line.
users="$("${SSH[@]}" "docker exec $NAME qoddy users")" || die "could not list the accounts on $HOST"
if [ -z "$users" ]; then
	if [ -t 0 ]; then
		echo "==> The database has no accounts yet: create the admin"
		while :; do
			read -rp "Admin email: " admin_email
			read -rp "Admin name: " admin_name
			read -rsp "Admin password: " admin_password && echo
			read -rsp "Repeat password: " again && echo
			if [ "$admin_password" != "$again" ]; then
				echo "The passwords differ." >&2
				continue
			fi
			printf '%s' "$admin_password" |
				"${SSH[@]}" "docker exec -i $NAME qoddy create-user $(printf '%q ' "$admin_email" "$admin_name")--admin" &&
				break
		done
		unset admin_password again
	else
		echo "Warning: the database has no accounts. Create the admin with:" >&2
		echo "  echo 'a long password' | ssh $HOST docker exec -i $NAME qoddy create-user you@example.com 'Your Name' --admin" >&2
	fi
fi

echo "==> Deployed $NAME on $HOST"
