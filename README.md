# backstage-techdocs-publisher

A GitHub Action that generates expected docs and publish one or more entities to desired cloud storage.

## Inputs

### `cloud-storage`

**Required** The chosen cloud storage to publish TechDocs content.

### `storage-name`

**Required** Bucket or container storage name.

### `gcs-bucket-root-path`

Optional sub-directory to store files in Google cloud storage.

### `azure-account-name`

_Required for Azure_ specify when storage input azureBlobStorage.

### `azure-account-key`

Azure Storage Account key to use for authentication. If not specified, you must set AZURE_TENANT_ID, AZURE_CLIENT_ID & AZURE_CLIENT_SECRET as environment variables.

### `os-credential-id`

_Required for OpenStack_ specify when cloud-storage is openStackSwift.

### `os-secret`

_Required for OpenStack_ specify when cloud-storage is openStackSwift.

### `os-auth-url`

_Required for OpenStack_ specify when cloud-storage is openStackSwift.

### `os-swift-url`

_Required for OpenStack_ specify when cloud-storage is openStackSwift.

### `aws-role-arn`

Optional AWS ARN of role to be assumed.

### `aws-endpoint`

Optional AWS endpoint to send requests to.

### `awsS3-sse`

Optional AWS S3 Server Side Encryption.

### `awsS3-force-path-style`

Optional AWS S3 option to force path style.

### `publish-looking-path`

Pathdir to get all entities to publish.

### `publish-looking-file`

Get entities backstage by main catalog file.

## Environment variables

### GOOGLE_APPLICATION_CREDENTIALS

**Required** if use `googleGcs` as selected cloud storage to publish.

### AWS_ACCESS_KEY_ID

**Required** if use `awsS3` as selected cloud storage to publish.

### AWS_SECRET_ACCESS_KEY

**Required** if use `awsS3` as selected cloud storage to publish.

### AWS_REGION

**Required** if use `awsS3` as selected cloud storage to publish.

### AZURE_TENANT_ID

**Required** if use `azureBlobStorage` as selected cloud storage to publish and `azure-account-key` field is null.

### AZURE_CLIENT_ID

**Required** if use `azureBlobStorage` as selected cloud storage to publish and `azure-account-key` field is null.

### AZURE_CLIENT_SECRET

**Required** if use `azureBlobStorage` as selected cloud storage to publish and `azure-account-key` field is null.

## Example usage

```yaml
uses: stone-payments/backstage-techdocs-publisher@v1
with:
  cloud-storage: googleGcs
  storage-name: '${{ secrets.TECHDOCS_GCS_BUCKET_NAME }}'
  publish-looking-file: somepath/catalog.yml
```
