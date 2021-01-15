# Github Action to setup the Apache Flex SDK

This action downloads the [Apache Flex SDK](https://flex.apache.org/), adds the _bin_ folder to the `PATH`, and sets the `FLEX_HOME` environment variable.

## Inputs

### `flex-version`

_(Optional)_ Version of the Apache Flex SDK. This value must include major, minor, and revision parts, such as `4.16.1`.

## Example usage

```yml
uses: joshtynjala/setup-apache-flex-action@v1
with:
  flex-version: "4.16.1"
```
