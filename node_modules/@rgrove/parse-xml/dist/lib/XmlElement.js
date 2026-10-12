import { XmlNode } from './XmlNode.js';
/**
 * Element in an XML document.
 */
export class XmlElement extends XmlNode {
    constructor(name, attributes = Object.create(null), children = []) {
        super();
        this.name = name;
        this.attributes = attributes;
        this.children = children;
    }
    /**
     * Whether this element is empty (meaning it has no children).
     */
    get isEmpty() {
        return this.children.length === 0;
    }
    get preserveWhitespace() {
        let node = this; // eslint-disable-line @typescript-eslint/no-this-alias
        while (node instanceof XmlElement) {
            if ('xml:space' in node.attributes) {
                return node.attributes['xml:space'] === 'preserve';
            }
            node = node.parent;
        }
        return false;
    }
    /**
     * Text content of this element and all its descendants.
     */
    get text() {
        return this.children
            .map(child => 'text' in child ? child.text : '')
            .join('');
    }
    get type() {
        return XmlNode.TYPE_ELEMENT;
    }
    toJSON() {
        return Object.assign(XmlNode.prototype.toJSON.call(this), {
            name: this.name,
            attributes: this.attributes,
            children: this.children.map(child => child.toJSON()),
        });
    }
}
