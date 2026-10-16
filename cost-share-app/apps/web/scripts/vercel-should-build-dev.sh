#!/usr/bin/env bash
# Legacy entrypoint — prefer vercel-should-build.sh via vercel.json ignoreCommand.
exec bash "$(dirname "$0")/vercel-should-build.sh"
