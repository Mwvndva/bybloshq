#!/bin/sh
# Container entrypoint: run pending migrations, then hand off to the server.
#
# Why this lives here instead of Render's Pre-Deploy Command: that field is
# locked on Render's free plan ("The pre-deploy command is available for paid
# web services..." -- render.com/docs/deploys), which is what this service
# actually runs on. A hand-typed command in Render's Docker Command dashboard
# field is not a fix either -- it isn't version controlled, isn't code
# reviewed, and (as tested) `npm run migrate && npm start` typed directly
# into that field doesn't behave as two chained commands the way it would in
# a real shell, because Render doesn't shell-split it before npm sees the
# arguments. Baking the sequence into the image itself is the reliable path.
#
# set -e: if migrations fail, the container must fail to start rather than
# boot the API against a schema its code doesn't match. That exact mismatch
# (code deployed expecting a column a migration never applied) is what caused
# the terms_accepted production incident this entrypoint exists to prevent.
set -e

npm run migrate

# exec node directly, NOT `exec npm start`. `npm start` still forks node as
# its own child process even under exec -- exec only replaces this shell, not
# the extra npm layer -- so Render's SIGTERM on every deploy's old-instance
# retirement (completely normal, happens on every single deploy) got relayed
# through npm's process wrapper, which unconditionally logs it as
# "npm error ... signal SIGTERM" regardless of whether the app underneath
# handled it gracefully (it does -- see index.js's SIGTERM handler, which
# drains connections and exits 0). That's harmless but reads exactly like a
# crash in the deploy logs. Invoking node directly makes it the actual
# process Render's signal reaches, and removes npm's misleading wrapper
# output from every routine deploy.
exec node src/index.js
