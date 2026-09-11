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

# exec (not a plain call) replaces this shell process with node, so SIGTERM
# from Render on redeploy/shutdown reaches the server directly for a clean
# shutdown instead of being absorbed by an intermediate shell.
exec npm start
