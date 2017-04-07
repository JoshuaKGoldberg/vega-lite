

/**
 * A node in the dataflow graph.
 */
export class DataFlowNode {
  private _children: DataFlowNode[];

  private _parent: DataFlowNode;
  constructor() {
    this._children = [];
    this._parent = null;
  };

  get parent() {
    return this._parent;
  }

  set parent(parent: DataFlowNode) {
    this._parent = parent;
    parent.addChild(this);
  }

  get children() {
    return this._children;
  }

  public addChild(child: DataFlowNode) {
    this._children.push(child);
  }

  public removeChild(oldChild: DataFlowNode) {
    this._children.splice(this._children.indexOf(oldChild), 1);
  }

  public remove() {
    this._children.forEach(child => {
      child.parent = this._parent;
    });

    this._parent.removeChild(this);
  }
}

export class OutputNode extends DataFlowNode {

  private _name: string;

  public source: string;

  constructor(name: string, private required = false) {
    super();

    this._name = name;
  }

  /**
   * Mark this node as required so we don't instantiate a data source in Vega.
   */
  public setRequired() {
    this.required = true;
  }

  public needsAssembly() {
    return !(this.parent instanceof OutputNode) && this.required;
  }

  get name() {
    return this._name;
  }
}
