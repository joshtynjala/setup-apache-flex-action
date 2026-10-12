import { XmlElement } from './XmlElement.js';
import { XmlNode } from './XmlNode.js';
/**
 * Represents an XML document. All elements within the document are descendants
 * of this node.
 */
export class XmlDocument extends XmlNode {
    constructor(children = []) {
        super();
        this.children = children;
    }
    get document() {
        return this;
    }
    /**
     * Root element of this document, or `null` if this document is empty.
     */
    get root() {
        for (let child of this.children) {
            if (child instanceof XmlElement) {
                return child;
            }
        }
        return null;
    }
    /**
     * Text content of this document and all its descendants.
     */
    get text() {
        return this.children
            .map(child => 'text' in child ? child.text : '')
            .join('');
    }
    get type() {
        return XmlNode.TYPE_DOCUMENT;
    }
    toJSON() {
        return Object.assign(XmlNode.prototype.toJSON.call(this), {
            children: this.children.map(child => child.toJSON()),
        });
    }
}
