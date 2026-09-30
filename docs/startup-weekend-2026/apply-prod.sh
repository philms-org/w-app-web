#!/bin/sh
# Applies migrations 0024-0031 to PROD in one transaction (rolls back on any error).
# 0030 uses the adjusted copy because prod already has is_checked_in_at().
set -e
cd "$(dirname "$0")/../.."
M=supabase/migrations
supabase link --project-ref yatixschvikugckkpfum
(echo "begin;"
 cat $M/0024_venue_event_feed.sql $M/0025_venue_feed_followups.sql $M/0026_profiles_public_view.sql \
     $M/0027_auth_rate_limits.sql $M/0028_fix_master_admin_guard.sql $M/0029_venue_announcements.sql \
     docs/startup-weekend-2026/0030_prod_adjusted.sql $M/0031_announcers_and_announcement_posts.sql
 echo "commit;") | supabase db query --linked
