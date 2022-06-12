/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npx wrangler dev src/index.js` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npx wrangler publish src/index.js --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Router } from 'itty-router'
import { initSentry } from '@cloudflare/worker-sentry'
import { handleSlackRequest, handleAuthRequest, handleScheduled } from './handlers'

const router = Router()

router.post("/slack", async (request, sentry, e) => {
  const response = await handleSlackRequest(request, sentry, e);

  return new Response(response, { headers: { 'Content-type': 'application/json' } })
})

router.get("/callback", async (request, sentry, e) => {
  console.info(`[redirect] New app auth request`)
  sentry.addBreadcrumb({
    category: 'slack-callback',
    message: `New app auth request`,
    data: request,
    level: 'info',
  });
  sentry.setTag('type', 'slack-auth');

  const url = await handleAuthRequest(request, sentry);
  return Response.redirect(url, 301)
})

router.get("/redirect", async (request, sentry) => {
  console.info(`[redirect] New app installation request`)
  sentry.addBreadcrumb({
    category: 'slack-redirect',
    message: `New app installation request`,
    data: request,
    level: 'info',
  });
  sentry.setTag('type', 'slack-auth');

  return Response.redirect(`https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=chat:write,commands,im:write,team:read,users:read,users:read.email,im:read&user_scope=`, 302)
})

/*
This is the last route we define, it will match anything that hasn't hit a route we've defined
above, therefore it's useful as a 404 (and avoids us hitting worker exceptions, so make sure to include it!).
Visit any page that doesn't exist (e.g. /foobar) to see it in action.
*/
router.all("*", () => new Response("404, not found!", { status: 404 }))

/*
This snippet ties our worker to the router we deifned above, all incoming requests
are passed to the router where your routes are called and the response is sent.
*/
addEventListener('fetch', (e) => {
  const sentry = initSentry(e);

  try {
    e.respondWith(router.handle(e.request, sentry, e))
  } catch (ex) {
    sentry.captureException(ex)
    console.warn(ex)
    return new Response("internal error", { status: 500, message: ex });
  }
})

/*
Listening to the CRON events
*/
addEventListener('scheduled', e => {
  const sentry = initSentry(e);

  try {
    e.waitUntil(handleScheduled(e, sentry));
  } catch (ex) {
    sentry.captureException(ex)
    console.warn(ex)
  }
})