# Github Action to setup the Apache Flex SDK

This action downloads the [Apache Flex SDK](https://flex.apache.org/), adds the _bin_ folder to the `PATH`, and sets the `FLEX_HOME` environment variable. The setup process also integrates the [Adobe AIR SDK by HARMAN](https://airsdk.harman.com/).

## Inputs

### `flex-version`

_(Required)_ The version of the Apache Flex SDK to set up. An exact version, such as `4.16.1`, is recommended. However, a less specific version, like `4.16` is allowed.

### `air-version`

_(Required)_ The version of the Adobe AIR SDK to set up. An exact version, such as `50.0.1.1`, is recommended. However, a less specific version, like `50.0` or `50`, is allowed.

### `accept-air-license`

_(Required)_ Set to `true` if you accept the [Adobe AIR SDK License Agreement](https://airsdk.harman.com/assets/pdfs/HARMAN%20AIR%20SDK%20License%20Agreement.pdf). The action will fail if the agreement is not accepted.

### `air-license-base64`

_(Optional)_ Use with an [encrypted secret](https://docs.github.com/en/actions/security-guides/encrypted-secrets) to optionally provide a valid _adt.lic_ file, [encoded as a Base64 string](https://docs.github.com/en/actions/security-guides/encrypted-secrets#storing-base64-binary-blobs-as-secrets), to unlock new, restricted features in the Adobe AIR SDK by HARMAN.

**Warning!** Never include the raw Base64-encoded string value directly in your Github Actions _.yml_ file. You **must** use an [encrypted secret](https://docs.github.com/en/actions/security-guides/encrypted-secrets) to prevent your license file from being leaked publicly.

## Example usage

Use the Apache Flex SDK with the AIR SDK by HARMAN for free activities:

```yml
uses: joshtynjala/setup-apache-flex-action@v2
with:
  flex-version: "4.16.1"
  air-version: "50.0.1.1"
  accept-air-license: true
```

Specify an encypted secret containing a Base64-encoded license file to unlock the AIR SDK's new, restricted features:

```yml
uses: joshtynjala/setup-apache-flex-action@v2
with:
  flex-version: "4.16.1"
  air-version: "50.0.1.1"
  accept-air-license: true
  air-license-base64: ${{ secrets.AIR_SDK_LICENSE_FILE }}
```



