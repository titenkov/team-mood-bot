import qs from 'qs'
import { formatSlackMessage, formatInteractiveSetupMessage, formatInteractiveUserQuestion, formatInteractiveUserAnswer } from './slack'

/**
 * Handles the incoming slack requests
 * @param {*} request
 * @returns
 */
export const handleSlackRequest = async (request) => {
  const data = qs.parse(await request.text())

  console.debug(`[slack-request]: ${JSON.stringify(data)}`)

  const { text, token, payload } = data

  if (payload) {
    // Handle slack webhook call
    const payloadToken = JSON.parse(payload).token;

    // Verify payload token
    if (!payloadToken || payloadToken != SLACK_VERIFICATION_TOKEN) {
      console.error(`[slack-request] Unexpected missing or invalid token in slack request: ${payloadToken}`)
      return { ok: false, status: 401, text: 'Unauthorized' }
    }

    return processWebhookCall(JSON.parse(payload))
  }

  // Verify the token in request
  if (!token || token != SLACK_VERIFICATION_TOKEN) {
    console.error(`[slack-request] Unexpected missing or invalid token in slack request: ${token}`)
    return { ok: false, status: 401, text: 'Unauthorized' }
  }

  if (!text || text === 'help') {
    return handleHelp(data)
  }

  if (text === 'setup') {
    return handleSetup(data)
  }

  if (text === 'status') {
    return handleStatus(data)
  }

  if (text === 'analytics') {
    return handleAnalytics(data)
  }

  return formatSlackMessage('🤷‍♀️ I don\'t know this command. Please use `/moodlab help` to see available commands.')
}

const processWebhookCall = async (payload) => {
  console.debug(`[webhook] ${JSON.stringify(payload)}`)

  const { response_url, user, state, team, actions, api_app_id } = payload

  if (!actions || actions.length === 0) {
    return;
  }

  if ('x-cancel' === actions[0].action_id) {
    const message = `👍 No worries, you can always do it later`
    await fetch(response_url, {method: 'POST', body: JSON.stringify({ text: message })})

    return formatSlackMessage(message)
  }

  if (actions[0].action_id.startsWith('feedback-')) {
    console.debug(`[webhook] Received feedback ${JSON.stringify(payload)}`)

    const timestamp = new Date().toISOString()

    const data = {
      [timestamp]: actions[0].value
    }

    await KV_TEAM_MOOD_BOT.put(`feedback_${team.id}_${user.id}`, JSON.stringify(data), {
      metadata: { org_domain: team.domain, org_id: team.id, user_id: user.id, type: 'feedback' },
    });

    var res = await fetch(response_url, {method: 'POST', body: JSON.stringify({ blocks: formatInteractiveUserAnswer({}, { feedback_received: true, feedback_result: actions[0].text.text }) })})

    if(!res.ok) {
      console.debug(`[${team.domain}] Failed to process feedback for ${user.id}: ${res.status} ${await res.text()}`)
    }

    return formatInteractiveUserAnswer({}, { feedback_received: true, feedback_result: actions[0].text.text })
  }

  if ('x-submit' !== actions[0].action_id) {
    return
  }

  const members = state.values && state.values.members && state.values.members['multi_users_select-action'] && state.values.members['multi_users_select-action'].selected_users
  const administrators = state.values && state.values.administrators && state.values.administrators['multi_users_select-action'] && state.values.administrators['multi_users_select-action'].selected_users

  if (!members || members.length === 0 || !administrators || !administrators.length === 0) {
    const message = `⚠️ You need to specify at least one member and one administrator`
    await fetch(response_url, {method: 'POST', body: JSON.stringify({ text: message })})

    return formatSlackMessage(message);
  }

  console.info(`💫 [${team.id}] ${user.id} (${user.name}) is registering new team. Members ${members}. Administrators: ${administrators}`)

  const data = {
    config: {
      members: members,
      administrators: administrators
    },
    organization: {
      id: team.id,
      domain: team.domain
    },
    app_id: api_app_id,
    updated_by: {
      id: user.id,
      name: user.name
    },
    updated_at: new Date().toISOString()
  }

  await KV_TEAM_MOOD_BOT.put(`config_${team.id}`, JSON.stringify(data), {
    metadata: { org_domain: team.domain, org_id: team.id },
  });

  const message = `🎉 Great job! You are ready to go.\nYour team members will be receiving questions every week ✨\n`;
  await fetch(response_url, {method: 'POST', body: JSON.stringify({ text: message })});

  return formatSlackMessage(message);
}

const handleSetup = async (data) => {
  const { team_id } = data
  if (!team_id) {
    console.error(`[setup] Unexpected missing team_id in slack request ${data}`)
    return
  }

  const team_config = await KV_TEAM_MOOD_BOT.get(`config_${team_id}`, { type: "json" })
  let params = {}

  if (team_config) {
    console.debug(`[setup] Found config for org ${team_id}: ${JSON.stringify(team_config)}`)
    params.members = team_config.config && team_config.config.members
    params.administrators = team_config.config && team_config.config.administrators
  }

  return formatInteractiveSetupMessage(data, params);
}

const handleStatus = async (data) => {
  // todo
}

const handleAnalytics = async (data) => {
  // todo
}

const handleHelp = async (data) => {
  return formatSlackMessage(`👩‍🎓 Hi! I'm TeamLab Bot. I'm going to help you to track the pulse of your team mood.\n\n*Available commands:*\n\n*setup* - Setup me\n*status* - Check my status\n*help* - Show this help message`)
}

export const handleScheduled = async (event) => {

  // Fetch all config
  const response = await KV_TEAM_MOOD_BOT.list({ prefix: 'config_' })
  const allConfigs = response.keys;

  console.debug(`[scheduled] All configs: ${JSON.stringify(allConfigs)}`)

  for (const configKey of allConfigs) {
    console.debug(`[scheduled] Processing ${configKey.name}`)

    const config = await KV_TEAM_MOOD_BOT.get(configKey.name, { type: "json" })

    if (!config) {
      console.error(`[scheduled] Unexpected missing config for ${configKey.name}`)
      continue
    }

    console.debug(`[scheduled] Config ${JSON.stringify(config)}`)

    console.info(`[scheduled] [${config.organization.id}] Found following members ${config.config.members}`)

    const members = (typeof config.config.members != 'undefined' && config.config.members instanceof Array ) ? config.config.members : [config.config.members]

    if (!members || members.length === 0) {
      console.info(`[scheduled] [${config.organization.id}] No members to process`)
      continue
    }

    for (const member of members) {
      console.debug(`[scheduled] [${config.organization.id}] Sending message to ${member}`)

      const token = await KV_TEAM_MOOD_BOT.get(`token_${config.organization.id}`)

      if (!token) {
        console.error(`[scheduled] [${config.organization.id}] Unexpected missing token while processing ${member}`)
        continue
      }

      const res = await fetch(`https://slack.com/api/chat.postMessage`,
        {
          method: 'POST',
          headers: new Headers({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ blocks: formatInteractiveUserQuestion(), channel: member }),
        }
      )

      if(!res.ok) {
        console.debug(`[scheduled] [${config.organization.id}] Failed to notify ${member}: ${res.status}`)
      }

      console.debug(`[scheduled] [${config.organization.id}] ${member}: ${JSON.stringify(await res.json())}`)
    }

  }
}

/**
 * Handles the OAuth requests
 * @param {*} request
 * @returns
 */
export const handleAuthRequest = async (request) => {
  const { query } = request

  if (!query || !query.code) {
    console.error(`[auth] Unexpected missing query or code in auth request`)
    return
  }

  const data = {
    client_id: SLACK_CLIENT_ID,
    client_secret: SLACK_CLIENT_SECRET,
    code: query.code,
  }

  const res = await fetch(`https://slack.com/api/oauth.v2.access`,
    {
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/x-www-form-urlencoded',
      }),
      body: qs.stringify(data),
    }
  )

  if (!res.ok) {
    console.error(`[auth] Failed to get access token: ${res.status}`)
    return
  }

  const json = await res.json()
  const { team, bot_user_id, authed_user, access_token } = json

  console.info(`[auth] Saving auth token for ${team.id}. Authenticated by ${authed_user.id}`)

  await KV_TEAM_MOOD_BOT.put(`token_${team.id}`, access_token, {
    metadata: { team_id: team.id, user_id: authed_user.id },
  });

  return `slack://user?team=${team.id}&id=${bot_user_id}`
}