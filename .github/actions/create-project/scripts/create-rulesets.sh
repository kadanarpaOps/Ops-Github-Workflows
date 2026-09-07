#!/usr/bin/env bash

set -euo pipefail

OWNER="$1"
REPOSITORY="$2"
GITHUB_TOKEN="$3"
BOT_APP_ID="$4"

API_URL="https://api.github.com/repos/${OWNER}/${REPOSITORY}/rulesets"

echo "========================================"
echo "Configuring GitHub Rulesets"
echo "Repository: ${OWNER}/${REPOSITORY}"
echo "========================================"

create_ruleset() {
    local name="$1"
    local payload="$2"

    echo ""
    echo "Creating ruleset: ${name}"

    RESPONSE=$(curl \
        --silent \
        --show-error \
        --write-out "\n%{http_code}" \
        --request POST \
        --url "$API_URL" \
        --header "Accept: application/vnd.github+json" \
        --header "Authorization: Bearer ${GITHUB_TOKEN}" \
        --header "X-GitHub-Api-Version: 2026-03-10" \
        --header "Content-Type: application/json" \
        --data "$payload")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    echo "GitHub API Response: ${HTTP_CODE}"

    if [[ "$HTTP_CODE" != "201" ]]; then
        echo "$BODY"
        echo "ERROR: Failed to create ruleset '${name}'."
        exit 1
    fi

    echo "Ruleset '${name}' created successfully."
}

# ============================================================
# RULESET 1
# Restrict Develop
# ============================================================

DEVELOP_RULESET=$(cat <<EOF
{
    "name": "Restrict Develop",
    "target": "branch",
    "enforcement": "active",

    "bypass_actors": [
        {
            "actor_id": ${BOT_APP_ID},
            "actor_type": "Integration",
            "bypass_mode": "always"
        }
    ],

    "conditions": {
        "ref_name": {
            "include": [
                "refs/heads/develop",
                "refs/heads/develop/**"
            ],
            "exclude": []
        }
    },

    "rules": [
        {
            "type": "creation"
        },
        {
            "type": "deletion"
        },
        {
            "type": "pull_request",
            "parameters": {
                "required_approving_review_count": 0,
                "dismiss_stale_reviews_on_push": false,
                "require_code_owner_review": false,
                "require_last_push_approval": false,
                "required_review_thread_resolution": false,
                "allowed_merge_methods": [
                    "merge",
                    "squash",
                    "rebase"
                ]
            }
        },
        {
            "type": "required_status_checks",
            "parameters": {
                "required_status_checks": [
                    {
                        "context": "Continuous Integration"
                    }
                ],
                "strict_required_status_checks_policy": true,
                "do_not_enforce_on_create": false
            }
        },
        {
            "type": "non_fast_forward"
        }
    ]
}
EOF
)

create_ruleset \
    "Restrict Develop" \
    "$DEVELOP_RULESET"

# ============================================================
# RULESET 2
# Restrict Creations / Updates
# ============================================================

BRANCH_RESTRICTION_RULESET=$(cat <<EOF
{
    "name": "Restrict Creations",
    "target": "branch",
    "enforcement": "active",

    "bypass_actors": [
        {
            "actor_id": ${BOT_APP_ID},
            "actor_type": "Integration",
            "bypass_mode": "always"
        }
    ],

    "conditions": {
        "ref_name": {
            "include": [
                "~ALL"
            ],
            "exclude": [
                "refs/heads/feature/**",
                "refs/heads/bugfix/**"
            ]
        }
    },

    "rules": [
        {
            "type": "creation"
        },
        {
            "type": "update"
        },
        {
            "type": "deletion"
        },
        {
            "type": "non_fast_forward"
        }
    ]
}
EOF
)

create_ruleset \
    "Restrict Creations" \
    "$BRANCH_RESTRICTION_RULESET"

echo ""
echo "========================================"
echo "GitHub Rulesets successfully configured."
echo "========================================"
