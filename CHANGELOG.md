# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [1.0.9](https://github.com/gergof/twitch-valorant-rr-bot/compare/v1.0.8...v1.0.9) (2026-04-06)


### Bug Fixes

* Added timestamp to log messages ([c3657a8](https://github.com/gergof/twitch-valorant-rr-bot/commit/c3657a8334c19e8d2511dc55370ace1d00eb59dc))


### Build/CI

* Improved docker build pipeline ([033118b](https://github.com/gergof/twitch-valorant-rr-bot/commit/033118ba22e5201083cd1fd054ffdd506ee302fb))

## [1.0.8](https://github.com/gergof/twitch-valorant-rr-bot/compare/v1.0.7...v1.0.8) (2026-04-06)


### Bug Fixes

* Reliably fetch the last match for the channel from the database ([cd11369](https://github.com/gergof/twitch-valorant-rr-bot/commit/cd11369ccc33ff3a2ee0b6c050ca3ff1a9bab43a))

## [1.0.7](https://github.com/gergof/twitch-valorant-rr-bot/compare/v1.0.6...v1.0.7) (2026-04-03)


### Bug Fixes

* **App:** Added rate limit to chat messages ([13c3ed9](https://github.com/gergof/twitch-valorant-rr-bot/commit/13c3ed948be311c4241815256f570226df648c17))
* Backfill latest off-stream match on online status, allow duplicates in valorant match id ([656e494](https://github.com/gergof/twitch-valorant-rr-bot/commit/656e494fe55926401c145939ea592a1b075f48da))
* **LiveMonitor:** Fixed monitor task constantly being rescheduled at every reconciliation ([9dd0c5b](https://github.com/gergof/twitch-valorant-rr-bot/commit/9dd0c5b910fb53afdda91df5f844960b2d0abc69))


### Build/CI

* Moved mikro-orm config to src dir to be properly handled by typescript ([f82b810](https://github.com/gergof/twitch-valorant-rr-bot/commit/f82b810e53e2ca748ffc395028b323d4a7966465))


### Documentation

* Updated landing page documentation ([152ec52](https://github.com/gergof/twitch-valorant-rr-bot/commit/152ec52774be69e68a22a5654bd7821e1a018a8a))

## [1.0.6](https://github.com/gergof/twitch-valorant-rr-bot/compare/v1.0.5...v1.0.6) (2026-04-01)


### Bug Fixes

* **server:** Removed bind to localhost ([04442cb](https://github.com/gergof/twitch-valorant-rr-bot/commit/04442cb9119672f4f4ef6d6344f30ad98f06ea7e))

## [1.0.5](https://github.com/gergof/twitch-valorant-rr-bot/compare/v1.0.4...v1.0.5) (2026-04-01)


### Build/CI

* Own application code by user ([5e3476a](https://github.com/gergof/twitch-valorant-rr-bot/commit/5e3476a74e3f08d6d6375764cf304524ece642a5))

## [1.0.4](https://github.com/gergof/twitch-valorant-rr-bot/compare/v1.0.3...v1.0.4) (2026-04-01)


### Build/CI

* Fixed typo ([e51d500](https://github.com/gergof/twitch-valorant-rr-bot/commit/e51d500492f4fbbb9de0eb4b698280548a0714bb))

## [1.0.3](https://github.com/gergof/twitch-valorant-rr-bot/compare/v1.0.2...v1.0.3) (2026-04-01)


### Build/CI

* Fixed migration issues ([5be9843](https://github.com/gergof/twitch-valorant-rr-bot/commit/5be9843c91fc1d6f586d5c587a8c4b0d350b575a))

## [1.0.2](https://github.com/gergof/twitch-valorant-rr-bot/compare/v1.0.1...v1.0.2) (2026-04-01)


### Build/CI

* Moved mikro-orm cli to prod dependencies ([4289c62](https://github.com/gergof/twitch-valorant-rr-bot/commit/4289c62191aa82be7f1774ed08898e66d333b233))

## [1.0.1](https://github.com/gergof/twitch-valorant-rr-bot/compare/v1.0.0...v1.0.1) (2026-04-01)


### Build/CI

* Fixed migration step in container ([64f7aad](https://github.com/gergof/twitch-valorant-rr-bot/commit/64f7aadb8c76a3dc8fa723597d5d6b9dde0e1e79))

## 1.0.0 (2026-04-01)


### Features

* Added account authorization logic ([4b020ca](https://github.com/gergof/twitch-valorant-rr-bot/commit/4b020ca595e3c3b9c3e41af3d8a6dd9d7151291b))
* Added bot authorization mode and fixed logic issues ([c531a2e](https://github.com/gergof/twitch-valorant-rr-bot/commit/c531a2e0f026c1a9776971aa50b480bf0ba84942))
* Added core logic ([77a9c02](https://github.com/gergof/twitch-valorant-rr-bot/commit/77a9c0219db325b8b5ab22dbf7697de99c99629c))
* Added logic for subscribing to live channel updates ([80ccb3b](https://github.com/gergof/twitch-valorant-rr-bot/commit/80ccb3bb1306182bbf43a47997ee612fd6e8e8a1))
* Added login logic, ejs layout, settings page ([c0fc378](https://github.com/gergof/twitch-valorant-rr-bot/commit/c0fc378a3f9a91623d26ea319f1aac077af70a86))
* Added matches page ([785a5a3](https://github.com/gergof/twitch-valorant-rr-bot/commit/785a5a327f750e18b5b5681c98135eb60db03712))
* Added new project scaffolding ([b9cd2de](https://github.com/gergof/twitch-valorant-rr-bot/commit/b9cd2de6dbdc4b15951af561fd206e8614a57630))
* Added proper error handling ([95c5b56](https://github.com/gergof/twitch-valorant-rr-bot/commit/95c5b56e555b5308f5842d694778fd2c3f1552ef))
* Added proper logging and shutdown logic ([938ce41](https://github.com/gergof/twitch-valorant-rr-bot/commit/938ce41702bc1598cac2cfecb98fe7ebe6223411))
* Added streams page ([c093393](https://github.com/gergof/twitch-valorant-rr-bot/commit/c0933938fb495339165d1b071e97f0ec5186be62))
* Added working settings ([0668d5b](https://github.com/gergof/twitch-valorant-rr-bot/commit/0668d5bf8ce3cc63f8697f8ab2c2b61c5231aeaa))
* Implemented MVP ([fd61b38](https://github.com/gergof/twitch-valorant-rr-bot/commit/fd61b3808cdac0e77f19e40de7398f803ac162c0))


### Bug Fixes

* Fixed logic flaws ([a533cc4](https://github.com/gergof/twitch-valorant-rr-bot/commit/a533cc479bbcb34cbcf4bd503aaff9487810d794))
* Fixed token renewal ([915855f](https://github.com/gergof/twitch-valorant-rr-bot/commit/915855f8ab96b68190d8bc16692dcec2b6cbd942))
* Updated texts on settings page ([0aab8b4](https://github.com/gergof/twitch-valorant-rr-bot/commit/0aab8b452a9918a3205023bfc77aa760662bc656))


### Build/CI

* Added build tooling ([76c8638](https://github.com/gergof/twitch-valorant-rr-bot/commit/76c8638da64b1d401cafa59449978641a56d6ac4))
* Run migrations on startup ([5eb2c3b](https://github.com/gergof/twitch-valorant-rr-bot/commit/5eb2c3bc96073ca896ed775339c2a26e1152de05))


### Documentation

* Added documentation and landing page ([3186eab](https://github.com/gergof/twitch-valorant-rr-bot/commit/3186eab6d5219c06956c5c1d8207bbb4fb81004e))
