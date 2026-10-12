import { XmlNode } from './XmlNode.js';
/**
 * Text content within an XML document.
 */
export class XmlText extends XmlNode {
    constructor(text = '') {
        super();
        this.text = text;
    }
    get type() {
        return XmlNode.TYPE_TEXT;
    }
    toJSON() {
        return Object.assign(XmlNode.prototype.toJSON.call(this), {
            text: this.text,
        });
    }
}
