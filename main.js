// @ts-check
const fetch = require("node-fetch").default;
const { parseXml } = require("@rgrove/parse-xml");
const core = require("@actions/core");
const toolCache = require("@actions/tool-cache");
const child_process = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ENV_FLEX_HOME = "FLEX_HOME";

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

function getFlexVersionLetterBestMatch(/** @type string */ expectedVersion, apacheFlexXML) {
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

  // default order is from oldest to newest, so let's reverse that
  versionLettersXML.reverse();

  let bestMatch = null;
  const requestedParts = expectedVersion.split(".");
  for (let releaseXML of versionLettersXML) {
    if (!("attributes" in releaseXML)) {
      continue;
    }
    const releaseVersion = releaseXML.attributes.version;
    const releaseParts = releaseVersion.split(".");
    let matched = true;
    for (let i = 0; i < requestedParts.length; i++) {
      if (requestedParts[i] != releaseParts[i]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      // this assumes that the releases are in order from newest to oldest
      bestMatch = releaseXML;
      break;
    }
  }
  if (bestMatch == null) {
    throw new Error(`Apache Flex SDK version '${expectedVersion}' not found`);
  }
  return bestMatch;
}

function getAIRVersionBestMatch(/** @type string */ airVersion, /** @type {any[]} */ releases) {
  let bestMatch = null;
  const requestedParts = airVersion.split(".");
  for (let release of releases) {
    const releaseName = release.name;
    const releaseParts = releaseName.split(".");
    let matched = true;
    for (let i = 0; i < requestedParts.length; i++) {
      if (requestedParts[i] != releaseParts[i]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      // this assumes that the releases are in order from newest to oldest
      bestMatch = releaseName;
      break;
    }
  }
  if (bestMatch == null) {
    throw new Error(`Adobe AIR SDK (HARMAN) version '${airVersion}' not found`);
  }
  return bestMatch;
}

function getFlexVersionLetterURL(versionLetterXML, mirrorPrefix) {
  let url = `${versionLetterXML.attributes.path}${versionLetterXML.attributes.file}`;
  if (!/^https?:\/\//.test(url)) {
    url = `${mirrorPrefix}/${url}`;
  }
  if (process.platform.startsWith("darwin") || process.platform.startsWith("linux")) {
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
    const acceptAIRLicense = core.getInput("accept-air-license", { required: true });
    if (!acceptAIRLicense) {
      throw new Error(
        "Parameter `accept-air-license` must be true to accept the Adobe AIR SDK License Agreement. Find it here: https://airsdk.harman.com/assets/pdfs/HARMAN%20AIR%20SDK%20License%20Agreement.pdf"
      );
    }
    const licenseFile = core.getInput("air-license-base64", { required: false });
    if (licenseFile) {
      const licenseBuffer = Buffer.from(licenseFile, "base64");
      const licensePath = path.join(os.homedir(), ".airsdk", "adt.lic");
      fs.mkdirSync(path.dirname(licensePath), { recursive: true });
      fs.writeFileSync(licensePath, licenseBuffer);
    }

    let flexVersion = core.getInput("flex-version", { required: true });
    const sdkConfigXML = await loadSDKConfig();
    const mirrorURLPrefix = await getMirrorURLPrefix(sdkConfigXML);
    const apacheFlexXML = getFlexSDKProducts(sdkConfigXML);

    const flexHome = await downloadFlexSDK(flexVersion, mirrorURLPrefix, apacheFlexXML);

    const airVersion = core.getInput("air-version", { required: true });
    const parsedMajorVersion = parseInt(airVersion.split(".")[0], 10);
    if (parsedMajorVersion <= 32) {
      // try to set up an old Adobe version of the AIR SDK
      setupApacheFlexWithAdobeAIR(airVersion, flexHome);
      return;
    }
    await setupApacheFlexWithHarmanAIR(airVersion, flexHome);
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function downloadFlexSDK(/** @type string */ flexVersion, /** @type string */ mirrorURLPrefix, /** @type any */ apacheFlexXML) {
  const flexVersionLetterXML = getFlexVersionLetterBestMatch(flexVersion, apacheFlexXML);

  console.log("Apache Flex SDK version: " + flexVersionLetterXML.attributes.version);

  const flexDownloadURL = getFlexVersionLetterURL(
    flexVersionLetterXML,
    mirrorURLPrefix
  );

  const flexDownloadFileName = path.basename(
    new URL(flexDownloadURL).pathname
  );
  const downloadedPath = await toolCache.downloadTool(
    flexDownloadURL,
    flexDownloadFileName
  );

  const installLocation = process.platform.startsWith("win")
    ? "c:\\ApacheFlexSDK"
    : "/usr/local/bin/ApacheFlexSDK";
  fs.mkdirSync(installLocation);

  if (process.platform.startsWith("darwin") || process.platform.startsWith("linux")) {
    await toolCache.extractTar(downloadedPath, installLocation);
  } else if (process.platform.startsWith("win")) {
    await toolCache.extractZip(downloadedPath, installLocation);
  }

  let flexHome = installLocation;
  if (process.platform.startsWith("darwin") || process.platform.startsWith("linux")) {
    const baseFileName = flexDownloadFileName.substr(
      0,
      flexDownloadFileName.length - 7 //.tar.gz
    );
    flexHome = path.resolve(installLocation, baseFileName);
  }
  core.addPath(path.resolve(flexHome, "bin"));
  core.exportVariable(ENV_FLEX_HOME, flexHome);
  return flexHome;
}

async function setupApacheFlexWithHarmanAIR(/** @type string */ airVersion, /** @type string */ flexHome) {
  const releasesResponse = await fetch(
    "https://dcdu3ujoji.execute-api.us-east-1.amazonaws.com/production/releases"
  );
  const releases = await releasesResponse.json();

  airVersion = getAIRVersionBestMatch(airVersion, releases.releases);
  console.log(`Adobe AIR SDK (HARMAN) version: ${airVersion}`);

  const urlsResponse = await fetch(
    `https://dcdu3ujoji.execute-api.us-east-1.amazonaws.com/production/releases/${airVersion}/urls`
  );
  const urls = await urlsResponse.json();

  var urlField = null;
  if (process.platform.startsWith("darwin")) {
    urlField = "AIR_Flex_Mac";
  } else if (process.platform.startsWith("win")) {
    urlField = "AIR_Flex_Win";
  } else if (process.platform.startsWith("linux")) {
    urlField = "AIR_Flex_Linux";
  }
  if (!urlField) {
    // this probably shouldn't happen, but best to be safe
    throw new Error(
      `Adobe AIR SDK version '${airVersion}' not found for platform ${process.platform}`
    );
  }
  console.log(`Adobe AIR SDK type: ${urlField}`);

  const archiveUrl = `https://airsdk.harman.com${urls[urlField]}?license=accepted`;
  const filename = path.basename(new URL(archiveUrl).pathname);

  const downloadedPath = await toolCache.downloadTool(archiveUrl, filename);

  const foundMajorMinor = /\d+\.\d+/.exec(airVersion);
  if (foundMajorMinor === null) {
    throw new Error(
      `Failed to parse Adobe AIR SDK version: ${airVersion}`
    );
  }
  const airSDKMajorMinor = foundMajorMinor[0];

  const antScriptPath = path.resolve(__dirname, "harman-installer.xml");

  child_process.execSync(
    `ant -f ${antScriptPath} -Dflexsdk=${flexHome} -Dairsdk.zip=${downloadedPath} -Dair.sdk.version=${airSDKMajorMinor}`,
    {
      cwd: flexHome,
      stdio: "inherit",
    }
  );
  
}

function setupApacheFlexWithAdobeAIR(/** @type string */ airVersion, /** @type string */ flexHome) {
  if (airVersion == "32") {
    airVersion += ".0";
  }
  if (airVersion != "32.0") {
    throw new Error(
      `Expected Adobe AIR major version 32 or newer. Received version: ${airVersion}`
    );
  }

  child_process.execSync(
    "ant -f installer.xml -Dflash.sdk.version=32.0 -Dair.sdk.version=32.0 -Dinstaller=true -Ddo.flash.install=1 -Ddo.air.install=1 -Ddo.swfobject.install=1 -Ddo.fontswf.install=1 -Ddo.osmf.install=1 -Ddo.ofl.install=1",
    {
      cwd: flexHome,
      stdio: "inherit",
    }
  );
}

setupApacheFlex();
