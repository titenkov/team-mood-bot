export const formatSlackMessage = (text) => {
  return JSON.stringify({
    'blocks': [
      {
        'type': 'section',
        'text': {
          'type': 'mrkdwn',
          'text': `${text}`
        }
      }
    ],
    'response_type': 'in_channel'
  })
};

export const formatInteractiveSetupMessage = (data, params) => {
  console.debug(`[interactive-setup-message] Params: ${JSON.stringify(params)}, Data: ${JSON.stringify(data)}`);

  return JSON.stringify({
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "Hello! 👋 \nWelcome to MoodLab Bot! I'm going to check pulse of your team by asking your team members how do they feel. Please provide required configuration to start."
        }
      },
      {
        "type": "input",
        "block_id": "members",
        "element": {
          "type": "multi_users_select",
          "placeholder": {
            "type": "plain_text",
            "text": "Select users",
            "emoji": true
          },
          "initial_users": params.members || [],
          "max_selected_items": 10,
          "action_id": "multi_users_select-action"
        },
        "label": {
          "type": "plain_text",
          "text": "Members",
          "emoji": true
        }
      },
      {
        "type": "context",
        "elements": [
          {
            "type": "plain_text",
            "text": "They are going to receive questions every Friday 🙌",
            "emoji": true
          }
        ]
      },
      {
        "type": "input",
        "block_id": "administrators",
        "element": {
          "type": "multi_users_select",
          "placeholder": {
            "type": "plain_text",
            "text": "Select users",
            "emoji": true
          },
          "initial_users": params.administrators || [],
          "max_selected_items": 10,
          "action_id": "multi_users_select-action"
        },
        "label": {
          "type": "plain_text",
          "text": "Administrators",
          "emoji": true
        }
      },
      {
        "type": "context",
        "elements": [
          {
            "type": "plain_text",
            "text": "They are going to have access to analytics and reports 📈",
            "emoji": true
          }
        ]
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "style": "primary",
            "action_id": "x-submit",
            "text": {
              "type": "plain_text",
              "text": "Let's go!",
              "emoji": true
            },
            "value": "click_submit"
          },
          {
            "type": "button",
            "action_id": "x-cancel",
            "text": {
              "type": "plain_text",
              "text": "Cancel",
              "emoji": true
            },
            "value": "click_cancel"
          }
        ]
      }
    ],
    "response_type": "in_channel"
  })
}

export const formatInteractiveUserQuestion = (data, params) => {
  console.debug(`[interactive-user-question] Params: ${JSON.stringify(params)}, Data: ${JSON.stringify(data)}`);

  return [
    {
      "type": "section",
      "text": {
        "type": "plain_text",
        "text": "Hi there 👋\n How was the week?",
        "emoji": true
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "😥 Bad",
            "emoji": true
          },
          "value": "-2",
          "action_id": "feedback-0"
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "😔 Not so good",
            "emoji": true
          },
          "value": "-1",
          "action_id": "feedback-1"
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "😐 Ok",
            "emoji": true
          },
          "value": "0",
          "action_id": "feedback-2"
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "🙂 Good",
            "emoji": true
          },
          "value": "1",
          "action_id": "feedback-3"
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "🤩 Awesome",
            "emoji": true
          },
          "value": "2",
          "action_id": "feedback-4"
        }
      ]
    }
  ]
}

export const formatInteractiveUserAnswer = (data, params) => {
  console.debug(`[interactive-user-answer] Params: ${JSON.stringify(params)}, Data: ${JSON.stringify(data)}`);

  return JSON.stringify(
    [
      {
        "type": "section",
        "text": {
          "type": "plain_text",
          "text": "Thank you for feedback!",
          "emoji": true
        }
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": {
              "type": "plain_text",
              "text": `${params.feedback_result}`,
              "emoji": true
            }
          }
        ]
      }
    ]
  )
}