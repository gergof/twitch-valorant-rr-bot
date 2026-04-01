#!/usr/bin/env bash

set -euo pipefail

IMAGE_REPO="registry.systest.eu/twitch-valorant-rr-bot"
BUILD_TAG="local-build"

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Missing required command: $1" >&2
		exit 1
	fi
}

require_command git
require_command docker

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	echo "build.sh must be run from inside a git repository" >&2
	exit 1
fi

HEAD_TAGS="$(git tag --points-at HEAD)"
SHORT_SHA="$(git rev-parse --short HEAD)"

docker build -t "${IMAGE_REPO}:${BUILD_TAG}" .

if [[ -n "${HEAD_TAGS}" ]]; then
	RELEASE_TAG="$(printf '%s\n' "${HEAD_TAGS}" | head -n 1)"

	echo "Pushing tagged release image: ${RELEASE_TAG}"
	docker tag "${IMAGE_REPO}:${BUILD_TAG}" "${IMAGE_REPO}:${RELEASE_TAG}"
	docker tag "${IMAGE_REPO}:${BUILD_TAG}" "${IMAGE_REPO}:latest"
	docker push "${IMAGE_REPO}:${RELEASE_TAG}"
	docker push "${IMAGE_REPO}:latest"
else
	echo "HEAD is not tagged, pushing commit image: ${SHORT_SHA}"
	docker tag "${IMAGE_REPO}:${BUILD_TAG}" "${IMAGE_REPO}:${SHORT_SHA}"
	docker push "${IMAGE_REPO}:${SHORT_SHA}"
fi
