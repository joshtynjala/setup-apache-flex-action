// @ts-check
const fetch = require("node-fetch").default;
const { parseXml } = require("@rgrove/parse-xml");
const core = require("@actions/core");
const toolCache = require("@actions/tool-cache");
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");

const sdkConfigParseErrorText =
  "Failed to parse Apache Flex SDK configuration file";
const sdkConfigURL =
  "http://flex.apache.org/installer/sdk-installer-config-4.0.xml";

async function loadSDKConfig() {
  const sdkConfigResponse = await fetch(sdkConfigURL);
  if (!sdkConfigResponse.ok) {
    throw new Error("Failed to load Apache Flex SDK configuration file");
  }
  const sdkConfigText = await sdkConfigResponse.text();
  const sdkConfigXML = parseXml(sdkConfigText);
  return sdkConfigXML;
}

async function getMirrorURLPrefix(sdkConfigXML) {
  if (!sdkConfigXML || !("children" in sdkConfigXML)) {
    throw new Error(sdkConfigParseErrorText);
  }

  const configXML = sdkConfigXML.children.find((child) => {
    return child.type === "element" && child.name === "config";
  });

  if (!configXML || !("children" in configXML)) {
    throw new Error(sdkConfigParseErrorText);
  }

  const mirrorXML = configXML.children.find((child) => {
    return (
      child.type === "element" &&
      child.name === "mirror" &&
      "attributes" in child &&
      child.attributes.name === "MirrorURLCGI"
    );
  });

  if (!mirrorXML || !("attributes" in mirrorXML)) {
    throw new Error(sdkConfigParseErrorText);
  }

  const mirrorCGIFileName = mirrorXML.attributes.file;
  const mirrorCGIURL = `https://flex.apache.org/${mirrorCGIFileName}`;

  const mirrorResponse = await fetch(mirrorCGIURL);
  if (!mirrorResponse.ok) {
    throw new Error("Failed to load mirror for Apache Flex SDK");
  }
  return await mirrorResponse.text();
}

function getFlexSDKProducts(sdkConfigXML) {
  if (!sdkConfigXML || !("children" in sdkConfigXML)) {
    throw new Error();
  }

  const configXML = sdkConfigXML.children.find((child) => {
    return child.type === "element" && child.name === "config";
  });

  if (!configXML || !("children" in configXML)) {
    throw new Error(sdkConfigParseErrorText);
  }

  const productsXML = configXML.children.find((child) => {
    return child.type === "element" && child.name === "products";
  });

  if (!productsXML || !("children" in productsXML)) {
    throw new Error(sdkConfigParseErrorText);
  }

  const apacheFlexXML = productsXML.children.find((child) => {
    return child.type === "element" && child.name === "ApacheFlexSDK";
  });

  if (!apacheFlexXML || !("attributes" in apacheFlexXML)) {
    throw new Error(sdkConfigParseErrorText);
  }

  return apacheFlexXML;
}

function getVersion(expectedVersion, apacheFlexXML) {
  if (!apacheFlexXML || !("children" in apacheFlexXML)) {
    throw new Error(sdkConfigParseErrorText);
  }

  const versionsXML = apacheFlexXML.children.find((child) => {
    return child.type === "element" && child.name === "versions";
  });

  if (!versionsXML || !("children" in versionsXML)) {
    throw new Error(sdkConfigParseErrorText);
  }

  const versionLettersXML = versionsXML.children.filter((child) => {
    return child.type === "element" && child.name.startsWith("version");
  });

  if (versionLettersXML.length === 0) {
    throw new Error(sdkConfigParseErrorText);
  }

  return versionLettersXML.find((versionLetterXML) => {
    return (
      "attributes" in versionLetterXML &&
      versionLetterXML.attributes.version === expectedVersion
    );
  });
}

function getVersionLetterURL(versionLetterXML, mirrorPrefix) {
  let url = `${versionLetterXML.attributes.path}${versionLetterXML.attributes.file}`;
  if (!/^https?:\/\//.test(url)) {
    url = `${mirrorPrefix}/${url}`;
  }
  if (process.platform.startsWith("darwin")) {
    url += ".tar.gz";
  } else if (process.platform.startsWith("win")) {
    url += ".zip";
  } else {
    throw new Error(
      `Apache Flex SDK setup is not supported on platform: ${process.platform}`
    );
  }
  return url;
}

async function setupApacheFlex() {
  try {
    let flexVersion = core.getInput("flex-version");
    if (flexVersion && !/^\d+\.\d+.\d+$/.test(flexVersion)) {
      throw new Error(`Invalid Apache Flex version: ${flexVersion}`);
    }

    const sdkConfigXML = await loadSDKConfig();
    const apacheFlexXML = getFlexSDKProducts(sdkConfigXML);

    if (!flexVersion) {
      flexVersion = apacheFlexXML.attributes.latestVersion;
    }
    console.log("Apache Flex version: " + flexVersion);

    const mirrorURLPrefix = await getMirrorURLPrefix(sdkConfigXML);

    const flexDownloadURL = getVersionLetterURL(
      getVersion(flexVersion, apacheFlexXML),
      mirrorURLPrefix
    );

    const flexDownloadFileName = path.basename(
      new URL(flexDownloadURL).pathname
    );
    const downloadedPath = await toolCache.downloadTool(
      flexDownloadURL,
      flexDownloadFileName
    );

    let installLocation = process.platform.startsWith("win")
      ? "c:\\ApacheFlexSDK"
      : "/usr/local/bin/ApacheFlexSDK";
    fs.mkdirSync(installLocation);

    if (process.platform.startsWith("darwin")) {
      await toolCache.extractTar(downloadedPath, installLocation);
    } else if (process.platform.startsWith("win")) {
      await toolCache.extractZip(downloadedPath, installLocation);
    }

    let flexHome = installLocation;
    if (process.platform.startsWith("darwin")) {
      const baseFileName = flexDownloadFileName.substr(
        0,
        flexDownloadFileName.length - 7 //.tar.gz
      );
      flexHome = path.resolve(installLocation, baseFileName);
    }
    core.addPath(path.resolve(flexHome, "bin"));
    core.exportVariable("FLEX_HOME", flexHome);

    child_process.execSync(
      "ant -f installer.xml -Dflash.sdk.version=32.0 -Dair.sdk.version=32.0 -Dinstaller=true -Ddo.flash.install=1 -Ddo.air.install=1 -Ddo.swfobject.install=1 -Ddo.fontswf.install=1 -Ddo.osmf.install=1 -Ddo.ofl.install=1",
      {
        cwd: flexHome,
        stdio: "inherit",
      }
    );
  } catch (error) {
    core.setFailed(error.message);
  }
}
setupApacheFlex();
