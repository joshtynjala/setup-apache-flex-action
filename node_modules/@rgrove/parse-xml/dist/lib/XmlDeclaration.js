import { XmlNode } from './XmlNode.js';
/**
 * An XML declaration within an XML document.
 *
 * @example
 *
 * ```xml
 * <?xml version="1.0" encoding="UTF-8"?>
 * ```
 */
export class XmlDeclaration extends XmlNode {
    constructor(version, encoding, standalone) {
        super();
        this.version = version;
        this.encoding = encoding ?? null;
        this.standalone = standalone ?? null;
    }
    get type() {
        return XmlNode.TYPE_XML_DECLARATION;
    }
    toJSON() {
        let json = XmlNode.prototype.toJSON.call(this);
        json.version = this.version;
        for (let key of ['encoding', 'standalone']) {
            if (this[key] !== null) {
                json[key] = this[key];
            }
        }
        return json;
    }
}
