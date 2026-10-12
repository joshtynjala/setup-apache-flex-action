import { XmlNode } from './XmlNode.js';
/**
 * A document type declaration within an XML document.
 *
 * @example
 *
 * ```xml
 * <!DOCTYPE kittens [
 *   <!ELEMENT kittens (#PCDATA)>
 * ]>
 * ```
 */
export class XmlDocumentType extends XmlNode {
    constructor(name, publicId, systemId, internalSubset) {
        super();
        this.name = name;
        this.publicId = publicId ?? null;
        this.systemId = systemId ?? null;
        this.internalSubset = internalSubset ?? null;
    }
    get type() {
        return XmlNode.TYPE_DOCUMENT_TYPE;
    }
    toJSON() {
        let json = XmlNode.prototype.toJSON.call(this);
        json.name = this.name;
        for (let key of ['publicId', 'systemId', 'internalSubset']) {
            if (this[key] !== null) {
                json[key] = this[key];
            }
        }
        return json;
    }
}
