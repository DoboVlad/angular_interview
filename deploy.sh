#!/bin/bash
set -e

# -----------------------------------------------------------------------------
# Deploy the production build to an S3 static-website bucket, with an optional
# CloudFront invalidation.
#
# Required:  S3_BUCKET            target bucket name
# Optional:  CLOUDFRONT_DIST_ID   distribution id to invalidate after sync
#            AWS_REGION           shown in the final URL hint (default us-east-1)
#
# Usage:     S3_BUCKET=my-bucket ./deploy.sh
# -----------------------------------------------------------------------------

BUCKET=${S3_BUCKET:?Set S3_BUCKET env var}
DIST_ID=${CLOUDFRONT_DIST_ID:-""}       # optional
REGION=${AWS_REGION:-us-east-1}

echo "Building..."
ng build --configuration production

echo "Syncing to s3://$BUCKET..."
# Hashed assets get a long cache lifetime; index.html is excluded here and
# uploaded separately with a no-cache policy so deploys are picked up instantly.
aws s3 sync dist/*/browser/ s3://$BUCKET/ \
  --delete \
  --cache-control "max-age=31536000" \
  --exclude "index.html"

aws s3 cp dist/*/browser/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

if [ -n "$DIST_ID" ]; then
  echo "Invalidating CloudFront..."
  aws cloudfront create-invalidation \
    --distribution-id $DIST_ID \
    --paths "/*"
fi

echo "Done. Visit: http://$BUCKET.s3-website-$REGION.amazonaws.com"
