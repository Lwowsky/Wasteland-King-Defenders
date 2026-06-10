# TECHNICAL DOCUMENTATION v127

## Новий endpoint

```text
GET /api/admin/usage/firebase
```

## Worker secrets

```text
GOOGLE_SERVICE_ACCOUNT_JSON
GOOGLE_PROJECT_ID optional, fallback FIREBASE_PROJECT_ID
```

## Metrics

```text
firestore.googleapis.com/document/read_count
firestore.googleapis.com/document/write_count
firestore.googleapis.com/document/delete_count
firestore.googleapis.com/storage/data_and_index_storage_bytes
firestore.googleapis.com/network/active_connections
firestore.googleapis.com/network/snapshot_listeners
firestore.googleapis.com/rules/denied_request_count
```

## Cache

```text
wkd.firebaseRealUsageCache.v127
wkd.cloudflareRealUsageCache.v127
```

## Access
- Browser sends Firebase ID token.
- Worker verifies Firebase token.
- Worker checks UID in REGION_TABLE_ADMIN_UIDS.
- Worker calls Google Monitoring API with service account secret.
