import { XmlNode } from './XmlNode.js';
/**
 * A processing instruction within an XML document.
 */
export class XmlProcessingInstruction extends XmlNode {
    constructor(name, content = '') {
        super();
        this.name = name;
        this.content = content;
    }
    get type() {
        return XmlNode.TYPE_PROCESSING_INSTRUCTION;
    }
    toJSON() {
        return Object.assign(XmlNode.prototype.toJSON.call(this), {
            name: this.name,
            content: this.content,
        });
    }
}
