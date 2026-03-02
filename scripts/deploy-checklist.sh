#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# deploy-checklist.sh
# Production deployment preparation script for menethe-indexer (メンエスSKR)
#
# Usage:
#   ./scripts/deploy-checklist.sh env-template   # Generate .env.production.template
#   ./scripts/deploy-checklist.sh validate       # Validate env vars before deploy
#   ./scripts/deploy-checklist.sh migrate        # Push migrations to production Supabase
#   ./scripts/deploy-checklist.sh checklist      # Print the full deployment checklist
#   ./scripts/deploy-checklist.sh all            # Run validate + migrate
###############################################################################

###############################################################################
#  DEPLOYMENT CHECKLIST
#
#  Complete these steps IN ORDER before going live.
#
#  ---- Phase 1: Supabase Production ----
#
#  [ ] 1. Create Supabase production project
#         - Go to https://supabase.com/dashboard → New Project
#         - Region: ap-northeast-1 (Tokyo) recommended
#         - Postgres version: 17 (must match config.toml major_version)
#         - Save the database password securely
#
#  [ ] 2. Get production keys from Supabase Dashboard → Settings → API
#         - Project URL       → NEXT_PUBLIC_SUPABASE_URL
#         - anon (public) key → NEXT_PUBLIC_SUPABASE_ANON_KEY
#         - service_role key  → SUPABASE_SERVICE_ROLE_KEY (server-side only, NEVER expose)
#
#  [ ] 3. Link local Supabase CLI to production
#         supabase link --project-ref <PROJECT_REF>
#
#  [ ] 4. Run migrations on production Supabase
#         supabase db push
#         (This applies all 30 migrations in supabase/migrations/)
#         WARNING: Do NOT run `supabase db reset` on production.
#
#  [ ] 5. Configure Supabase Auth for production
#         - Dashboard → Authentication → URL Configuration
#         - Site URL: https://menes-indexer.com
#         - Redirect URLs: https://menes-indexer.com/**
#         - Enable email confirmations
#
#  [ ] 6. Configure Supabase Storage
#         - Verify therapist-images bucket exists after migration
#         - Set bucket to public if serving images directly
#
#  ---- Phase 2: Data Migration ----
#
#  [ ] 7. Migrate data from VPS dump to production Supabase
#         - salons (6,489 records)
#         - areas (821 records)
#         - therapists (228,816 records)
#         - seed reviews (16,462 records)
#         - salon descriptions (6,489 records)
#         - classification masters
#
#         Method A - pg_dump/pg_restore:
#           ssh -i ~/Downloads/indexer.pem root@220.158.18.6
#           pg_dump -Fc --data-only -t salons -t areas -t therapists ... > data.dump
#           pg_restore -d <PRODUCTION_DB_URL> data.dump
#
#         Method B - Supabase CLI:
#           Use local dump at database/dumps/therapists_with_storage_urls.sql.gz
#
#  [ ] 8. Verify data counts after migration
#         SELECT 'salons', count(*) FROM salons
#         UNION ALL SELECT 'areas', count(*) FROM areas
#         UNION ALL SELECT 'therapists', count(*) FROM therapists
#         UNION ALL SELECT 'reviews', count(*) FROM reviews;
#
#  [ ] 9. Migrate Storage images (185,039 therapist images)
#         - Images in local Supabase Storage need to be uploaded to production
#         - Or update image_urls to point to production Storage
#
#  ---- Phase 3: Stripe Configuration ----
#
#  [ ] 10. Configure Stripe for production
#          - Verify Stripe account is approved (submitted 2026-02-05)
#          - Use live mode keys (sk_live_*, not sk_test_*)
#          - STRIPE_SECRET_KEY
#          - STRIPE_WEBHOOK_SECRET
#          - STRIPE_STANDARD_PRICE_ID
#          - STRIPE_VIP_PRICE_ID
#
#  [ ] 11. Set up Stripe webhook for production URL
#          - Stripe Dashboard → Developers → Webhooks
#          - Endpoint URL: https://menes-indexer.com/api/webhook/stripe
#          - Events: invoice.payment_succeeded, customer.subscription.updated,
#                    customer.subscription.deleted
#          - Copy the webhook signing secret → STRIPE_WEBHOOK_SECRET
#
#  [ ] 12. Create Stripe Payment Links for production
#          - Standard plan (¥4,980/month) → NEXT_PUBLIC_STRIPE_STANDARD_LINK
#          - VIP plan (¥14,980/month) → NEXT_PUBLIC_STRIPE_VIP_LINK
#
#  ---- Phase 4: Vercel Configuration ----
#
#  [ ] 13. Set Vercel environment variables
#          - Go to Vercel Dashboard → menes-indexer → Settings → Environment Variables
#          - Add ALL variables from .env.production.template
#          - Scope: Production (and optionally Preview)
#          - Root Directory is already set to: frontend/demo1
#
#  [ ] 14. Set NEXT_PUBLIC_SITE_URL=https://menes-indexer.com
#          (Used for sitemap, robots.txt, OG metadata)
#
#  ---- Phase 5: Cloudflare / DNS ----
#
#  [ ] 15. Configure Cloudflare DNS
#          - A/CNAME record pointing menes-indexer.com to Vercel
#          - Vercel → Domains → add menes-indexer.com
#          - Cloudflare SSL mode: Full (strict)
#          - Enable Cloudflare CDN (orange cloud) for static assets
#
#  [ ] 16. Verify domain in Vercel
#          - Add domain in Vercel project settings
#          - Follow DNS verification steps
#
#  ---- Phase 6: Optional Enhancements ----
#
#  [ ] 17. Set up Upstash Redis for rate limiting (optional)
#          - UPSTASH_REDIS_REST_URL
#          - UPSTASH_REDIS_REST_TOKEN
#          - If not set, rate limiting is disabled (graceful fallback)
#
#  [ ] 18. Configure SMTP for transactional emails
#          - Supabase Dashboard → Authentication → SMTP Settings
#          - Or use Resend / SendGrid
#
#  [ ] 19. Enable Supabase Pro plan features (if needed)
#          - Image transformation API
#          - Branching
#          - Larger file uploads
#
#  ---- Phase 7: Final Verification ----
#
#  [ ] 20. Smoke test production site
#          - Home page loads
#          - Area pages load with salon data
#          - Therapist pages load with images
#          - Search functionality works
#          - User registration / login works
#          - Stripe payment flow works (use test card first if possible)
#          - Stripe webhook receives events
#          - Review submission works
#          - REAL/FAKE voting works
#          - robots.txt and sitemap.xml are accessible
#
#  [ ] 21. Monitor for errors
#          - Vercel → Logs for runtime errors
#          - Supabase → Logs for database errors
#          - Stripe → Dashboard for webhook delivery failures
#
#  VPS CONTRACT EXPIRES: 2026-04-30
#  Complete data migration before this date.
#
###############################################################################

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend/demo1"
TEMPLATE_FILE="$FRONTEND_DIR/.env.production.template"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

#------------------------------------------------------------------------------
# Required environment variables for production
#------------------------------------------------------------------------------
REQUIRED_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "STRIPE_STANDARD_PRICE_ID"
  "STRIPE_VIP_PRICE_ID"
  "NEXT_PUBLIC_STRIPE_STANDARD_LINK"
  "NEXT_PUBLIC_STRIPE_VIP_LINK"
)

OPTIONAL_VARS=(
  "NEXT_PUBLIC_SITE_URL"
  "UPSTASH_REDIS_REST_URL"
  "UPSTASH_REDIS_REST_TOKEN"
)

#------------------------------------------------------------------------------
# Functions
#------------------------------------------------------------------------------

print_header() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

cmd_env_template() {
  print_header "Generating .env.production.template"

  cat > "$TEMPLATE_FILE" <<'ENVEOF'
# =============================================================================
# Production Environment Variables for menethe-indexer (メンエスSKR)
# =============================================================================
# Copy this file to .env.production.local and fill in the values.
# NEVER commit .env.production.local to version control.
# Set these in Vercel Dashboard → Settings → Environment Variables for deploy.
# =============================================================================

# --- Supabase (REQUIRED) ---
# Get from: Supabase Dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=eyJ...YOUR_SERVICE_ROLE_KEY

# --- Site URL ---
# Used for sitemap.xml, robots.txt, and OG metadata
NEXT_PUBLIC_SITE_URL=https://menes-indexer.com

# --- Stripe (REQUIRED) ---
# Use LIVE mode keys for production (sk_live_*, not sk_test_*)
STRIPE_SECRET_KEY=sk_live_YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SIGNING_SECRET
STRIPE_STANDARD_PRICE_ID=price_YOUR_STANDARD_PRICE_ID
STRIPE_VIP_PRICE_ID=price_YOUR_VIP_PRICE_ID

# --- Stripe Payment Links (REQUIRED) ---
# Create in Stripe Dashboard → Payment Links
NEXT_PUBLIC_STRIPE_STANDARD_LINK=https://buy.stripe.com/YOUR_STANDARD_LINK
NEXT_PUBLIC_STRIPE_VIP_LINK=https://buy.stripe.com/YOUR_VIP_LINK

# --- Rate Limiting (OPTIONAL) ---
# If not set, rate limiting is disabled (graceful fallback in middleware.ts)
# Get from: https://console.upstash.com/ → Redis → REST API
# UPSTASH_REDIS_REST_URL=https://YOUR_REDIS.upstash.io
# UPSTASH_REDIS_REST_TOKEN=YOUR_UPSTASH_TOKEN
ENVEOF

  echo -e "${GREEN}Created:${NC} $TEMPLATE_FILE"
  echo ""
  echo "Next steps:"
  echo "  1. Copy to .env.production.local and fill in real values"
  echo "  2. Or set these variables in Vercel Dashboard"
  echo ""
}

cmd_validate() {
  print_header "Validating Production Environment Variables"

  local env_file="$FRONTEND_DIR/.env.production.local"
  local has_errors=0
  local has_warnings=0

  # Try to load from .env.production.local if it exists
  if [[ -f "$env_file" ]]; then
    echo -e "${GREEN}Loading from:${NC} $env_file"
    echo ""
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  else
    echo -e "${YELLOW}No .env.production.local found.${NC}"
    echo "Checking current environment variables instead."
    echo ""
  fi

  # Check required vars
  echo "Required variables:"
  echo "-------------------"
  for var in "${REQUIRED_VARS[@]}"; do
    local val="${!var:-}"
    if [[ -z "$val" ]]; then
      echo -e "  ${RED}MISSING${NC}  $var"
      has_errors=1
    elif [[ "$val" == *"PLACEHOLDER"* || "$val" == *"YOUR_"* || "$val" == *"127.0.0.1"* ]]; then
      echo -e "  ${YELLOW}PLACEHOLDER${NC}  $var  (still has placeholder value)"
      has_errors=1
    else
      # Mask sensitive values
      local masked
      if [[ "$var" == *"KEY"* || "$var" == *"SECRET"* ]]; then
        masked="${val:0:8}...${val: -4}"
      else
        masked="$val"
      fi
      echo -e "  ${GREEN}OK${NC}        $var = $masked"
    fi
  done

  echo ""
  echo "Optional variables:"
  echo "-------------------"
  for var in "${OPTIONAL_VARS[@]}"; do
    local val="${!var:-}"
    if [[ -z "$val" ]]; then
      echo -e "  ${YELLOW}NOT SET${NC}   $var  (feature will be disabled)"
      has_warnings=1
    else
      echo -e "  ${GREEN}OK${NC}        $var"
    fi
  done

  echo ""

  # Supabase-specific checks
  if [[ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]]; then
    if [[ "$NEXT_PUBLIC_SUPABASE_URL" == http://127.0.0.1* || "$NEXT_PUBLIC_SUPABASE_URL" == http://localhost* ]]; then
      echo -e "${RED}ERROR:${NC} NEXT_PUBLIC_SUPABASE_URL points to localhost. Use production URL."
      has_errors=1
    fi
    if [[ "$NEXT_PUBLIC_SUPABASE_URL" != https://* ]]; then
      echo -e "${YELLOW}WARNING:${NC} NEXT_PUBLIC_SUPABASE_URL does not use HTTPS."
      has_warnings=1
    fi
  fi

  # Stripe-specific checks
  if [[ -n "${STRIPE_SECRET_KEY:-}" ]]; then
    if [[ "$STRIPE_SECRET_KEY" == sk_test_* ]]; then
      echo -e "${YELLOW}WARNING:${NC} STRIPE_SECRET_KEY is a test key. Use sk_live_* for production."
      has_warnings=1
    fi
  fi

  echo ""
  echo "-------------------"
  if [[ $has_errors -eq 1 ]]; then
    echo -e "${RED}VALIDATION FAILED.${NC} Fix the issues above before deploying."
    return 1
  elif [[ $has_warnings -eq 1 ]]; then
    echo -e "${YELLOW}Validation passed with warnings.${NC} Review optional items above."
    return 0
  else
    echo -e "${GREEN}All checks passed.${NC} Ready for deployment."
    return 0
  fi
}

cmd_migrate() {
  print_header "Pushing Migrations to Production Supabase"

  # Check if supabase CLI is available
  if ! command -v supabase &> /dev/null; then
    echo -e "${RED}ERROR:${NC} supabase CLI not found. Install with:"
    echo "  brew install supabase/tap/supabase"
    exit 1
  fi

  # Check if linked to a remote project
  local linked_ref
  linked_ref=$(supabase --workdir "$PROJECT_ROOT" projects list 2>/dev/null | head -1 || true)

  echo "Working directory: $PROJECT_ROOT"
  echo ""

  # Count migrations
  local migration_count
  migration_count=$(ls "$PROJECT_ROOT/supabase/migrations/"*.sql 2>/dev/null | wc -l | tr -d ' ')
  echo "Found $migration_count migration files."
  echo ""

  echo "This will apply pending migrations to the linked production Supabase project."
  echo -e "${YELLOW}WARNING:${NC} Make sure you have linked to the correct project with:"
  echo "  supabase link --project-ref <YOUR_PROJECT_REF>"
  echo ""

  read -p "Continue? (y/N): " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
  fi

  echo ""
  echo "Running: supabase db push"
  echo ""

  cd "$PROJECT_ROOT"
  supabase db push

  echo ""
  echo -e "${GREEN}Migrations applied successfully.${NC}"
  echo ""
  echo "Verify with:"
  echo "  supabase db remote list"
}

cmd_checklist() {
  print_header "Production Deployment Checklist"

  cat <<'CHECKLIST'
Phase 1: Supabase Production
  [ ] Create Supabase production project (region: ap-northeast-1)
  [ ] Get production keys (URL, anon key, service_role key)
  [ ] Link local CLI: supabase link --project-ref <REF>
  [ ] Push migrations: supabase db push (30 migrations)
  [ ] Configure Auth: site_url, redirect URLs
  [ ] Verify Storage bucket (therapist-images)

Phase 2: Data Migration
  [ ] Migrate salons (6,489), areas (821), therapists (228,816)
  [ ] Migrate seed reviews (16,462), salon descriptions
  [ ] Migrate classification masters
  [ ] Migrate therapist images to production Storage (185,039)
  [ ] Verify data counts match expected values
  [ ] VPS contract expires 2026-04-30 — complete before then

Phase 3: Stripe Configuration
  [ ] Verify Stripe account approval
  [ ] Set live mode keys (sk_live_*)
  [ ] Create webhook: https://menes-indexer.com/api/webhook/stripe
  [ ] Webhook events: invoice.payment_succeeded, subscription.*
  [ ] Create Payment Links (Standard ¥4,980, VIP ¥14,980)

Phase 4: Vercel Configuration
  [ ] Set all environment variables in Vercel Dashboard
  [ ] Verify Root Directory = frontend/demo1
  [ ] Set NEXT_PUBLIC_SITE_URL = https://menes-indexer.com

Phase 5: Cloudflare / DNS
  [ ] DNS: menes-indexer.com → Vercel
  [ ] SSL mode: Full (strict)
  [ ] Enable CDN for static assets
  [ ] Add domain in Vercel and verify

Phase 6: Optional
  [ ] Upstash Redis for rate limiting
  [ ] SMTP for transactional emails
  [ ] Supabase Pro plan (if needed)

Phase 7: Verification
  [ ] Home page loads
  [ ] Area / therapist / review pages work
  [ ] Images load correctly
  [ ] User registration + login
  [ ] Stripe payment flow
  [ ] Webhook delivery
  [ ] robots.txt + sitemap.xml
  [ ] Monitor Vercel + Supabase + Stripe logs
CHECKLIST
}

cmd_all() {
  cmd_validate
  echo ""
  cmd_migrate
}

#------------------------------------------------------------------------------
# Main
#------------------------------------------------------------------------------

case "${1:-help}" in
  env-template)
    cmd_env_template
    ;;
  validate)
    cmd_validate
    ;;
  migrate)
    cmd_migrate
    ;;
  checklist)
    cmd_checklist
    ;;
  all)
    cmd_all
    ;;
  help|--help|-h|*)
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  env-template  Generate .env.production.template in frontend/demo1/"
    echo "  validate      Validate required env vars are set for production"
    echo "  migrate       Push migrations to production Supabase (requires link)"
    echo "  checklist     Print the full deployment checklist"
    echo "  all           Run validate + migrate"
    echo "  help          Show this help"
    echo ""
    ;;
esac
