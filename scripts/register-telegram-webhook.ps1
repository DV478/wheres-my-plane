# One-shot: tell Telegram where to POST updates.
#
# Usage:
#   .\scripts\register-telegram-webhook.ps1 `
#       -BotToken "<token from @BotFather>" `
#       -WebhookSecret "<any random 32+ char string>" `
#       -PublicBaseUrl "https://wheres-my-plane.pages.dev"
#
# After running:
#   1. Set TELEGRAM_BOT_TOKEN as a Pages secret.
#   2. Set TELEGRAM_WEBHOOK_SECRET (the exact string you passed here) as a Pages secret.
#   3. In Telegram, DM the bot /start to test.

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $BotToken,
  [Parameter(Mandatory = $true)] [string] $WebhookSecret,
  [Parameter(Mandatory = $true)] [string] $PublicBaseUrl
)

$ErrorActionPreference = 'Stop'

$webhookUrl = "$($PublicBaseUrl.TrimEnd('/'))/api/telegram/webhook"

$body = @{
  url                   = $webhookUrl
  secret_token          = $WebhookSecret
  drop_pending_updates  = $true
  allowed_updates       = @('message')
} | ConvertTo-Json -Depth 3

$resp = Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.telegram.org/bot$BotToken/setWebhook" `
  -ContentType 'application/json' `
  -Body $body

if (-not $resp.ok) {
  Write-Error "Telegram rejected setWebhook: $($resp.description)"
  exit 1
}

Write-Output "Webhook registered: $webhookUrl"
Write-Output ""
Write-Output "Verify with:"
Write-Output "  Invoke-RestMethod https://api.telegram.org/bot$BotToken/getWebhookInfo"
