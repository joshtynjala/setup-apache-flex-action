import { XmlNode } from './XmlNode.js';
/**
 * A comment within an XML document.
 */
export class XmlComment extends XmlNode {
    constructor(content = '') {
        super();
        this.content = content;
    }
    get type() {
        return XmlNode.TYPE_COMMENT;
    }
    toJSON() {
        return Object.assign(XmlNode.prototype.toJSON.call(this), {
            content: this.content,
        });
    }
}
