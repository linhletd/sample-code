class HistoryStackManager {
    constructor(domNode){
        this.observer = new MutationObserver(this.observerCallback);
        this.trackedNode = domNode;
        this.isObserving = false;
        this.head = this.createNewHistoryNode({});
        this.current = this.head;
        this.size = 100;
        this.length = 0;
        this.data = {
            textTimer: undefined,
            waitState: undefined,
            waitRecord: undefined,
        }
    }
    observerCallback = (mutations, observer) =>{
        let record = [];
        mutations.map((m, idx) =>{
            let {addedNodes, attributeName, nextSibling, oldValue, previousSibling, removedNodes, target, type } = m;
            switch(type){
                case 'attributes':{
                    this.clearTextTimeOut();
                    let newValue = target.attributes[attributeName].value;
                    let regex = /(?:img_focus|holder_before)$/
                    if(oldValue === newValue || attributeName === 'class' && (regex.test(oldValue)|| regex.test(newValue))){
                        break;
                    }
                    record.push({
                        type,
                        target,
                        attributeName,
                        oldValue,
                        newValue
                    });
                    break;
                }
                case 'characterData':{
                    let prevChange, len;
                    this.current.change.record && (prevChange = this.current.change.record, len = prevChange.length) 
                    if(prevChange && len <= 2 && prevChange[len -1].type == type && prevChange[len -1].target == target && 
                        this.data.textTimer && mutations.length == 1) {
                        prevChange[len -1].newValue = target.nodeValue;
                        return;
                    }
                    else {
                        prevChange = record;
                        len = record.length;
                        if(len && prevChange[len -1].type == type && prevChange[len -1].target == target){
                            // do nothing
                        }
                        else{
                            record.push({
                                type,
                                target,
                                oldValue,
                                newValue: target.nodeValue
                            })
                        }

                        if(idx == mutations.length - 1 && mutations.length <= 2){
                            this.setTextTimeOut();
                        }
                        else{
                            this.clearTextTimeOut();
                        }  
                    }
                    break;
                }
                case 'childList':{
                    this.clearTextTimeOut();
                    if(addedNodes.length && removedNodes.length){
                        record.push({
                            type: 'replaceNode',
                            addedNodes,
                            removedNodes,
                            target,
                            previousSibling,
                            nextSibling
                        });
                    }
                    else if(addedNodes.length){
                        record.push({
                            type: 'addNode',
                            addedNodes,
                            target,
                            previousSibling,
                            nextSibling
                        })
                    }
                    else{
                        record.push({
                            type: 'removeNode',
                            removedNodes,
                            target,
                            previousSibling,
                            nextSibling
                        })
                    }
                    break; 
                }
            }
        });
        let change, newNode;
        record.length && (change = {range: undefined, record}) && (newNode = this.createNewHistoryNode(change));
        this.addNewHistoryNode(newNode);

    }
    updateRange = (range) =>{
        if(this.current.next){
            return;
        }
        this.current.change.range = range;
    };
    updatePendingState = (type) =>{
        this.data.waitState = type;
    }
    reApplyRange = (range, subject) =>{
        if(!range) return;
        let {startContainer, startOffset, endContainer, endOffset} = range;
        let r = new Range();
        r.setStart(startContainer, startOffset);
        r.setEnd(endContainer, endOffset);
        let sel = document.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        subject.currentRange = r;
        subject.traveler.checkRange(r);
    }
    clearTextTimeOut = () =>{
        this.data.textTimer && clearTimeout(this.data.textTimer);
        this.data.textTimer = undefined;
    }
    setTextTimeOut = () =>{
        this.clearTextTimeOut()
        this.data.textTimer = setTimeout(() => {
            this.clearTextTimeOut();
        }, 3000);
    }
    startObserving = ()=>{
        if(!this.isObserving){
            this.isObserving = true;
            this.observer.observe(this.trackedNode, {
                attributes: true,
                childList: true,
                subtree: true,
                characterData: true,
                attributeOldValue: true,
                characterDataOldValue: true
            });
        }
    }
    stopObserving = ()=>{
        if(this.isObserving){
            this.isObserving = false;
            this.observer.disconnect();
        }
    }
    createNewHistoryNode(change){
        return {
            prev: null,
            next: null,
            change
        };
    }
    addNewHistoryNode = (node) =>{
        if(!node) return;
        if(this.current && this.current.next){
            return this.changeDirection(node);
        }
        if(this.length === this.size){
            this.head = this.head.next;
            this.head.change.record = null;
            this.head.prev = null;
        }
        this.current.next = node;
        node.prev = this.current;
        this.current = node;
        this.length++;
        if(this.props.toolbarState.undo === 0){
            // this.props.updateState({
            //     type: 'TOOLBARCHANGE',
            //     data: {undo: 1}
            // })
            this.props.changer.setToolbarState({undo: 1});
        }
    }
    distanceFromCurrentToTail = () => {
        let distance = 0;
        let traversal = this.current;
        while(traversal.next){
            distance++;
            traversal = traversal.next;
        }
        return distance;
    }
    goBackward = () => {
        if(!this.current.prev){
            return;
        }
        this.current = this.current.prev;
    }
    goForward = () =>{
        if(!this.current.next){
            return;
        }
        this.current = this.current.next;
    }
    changeDirection = (node) => {
        this.length = this.length - this.distanceFromCurrentToTail() + 1;
        this.current.next = node;
        node.prev = this.current;
        this.current = node;
    }
    setRange(target, prev, next){
        let r = new Range();
        if(prev && next){
            r.setStartAfter(prev);
            r.setEndBefore(next);
        }
        else if(prev){
            r.setStartAfter(prev);
            r.setEndAfter(target.lastChild);
        }
        else if(next){
            r.setStartBefore(target.firstChild);
            r.setEndBefore(next);
        }
        else{
            r.selectNodeContents(target);
        }
        return r;
    }
    replaceWithNodeList(r, list){
        r.deleteContents();
        let fragment = new DocumentFragment();
        list.forEach(node => {fragment.appendChild(node)});
        r.insertNode(fragment);
    }
    redo = (subject) =>{
        if(!this.current.next){
            return;
        }
        this.stopObserving();
        let actions = this.current.next.change.record;
        actions.map(action => {
            switch(action.type){
                case 'attributes':{
                    let {attributeName: attr, target, newValue} = action;
                    target[attr] = newValue;
                    break;
                }
                case 'characterData':{
                    let {target, newValue} = action;
                    target.nodeValue = newValue;
                    break;
                }
                case 'replaceNode': case 'addNode': {
                    let {addedNodes, target, previousSibling: prev, nextSibling: next} = action;
                    let r = this.setRange(target, prev, next);
                    this.replaceWithNodeList(r, addedNodes);
                    break;
                }
                case 'removeNode': {
                    let {target, previousSibling: prev, nextSibling: next} = action;
                    let r = this.setRange(target, prev, next);
                    r.deleteContents();
                    break;
                }    
            }
        })
        this.startObserving();
        this.reApplyRange(this.current.next.change.range, subject);
        this.current = this.current.next;
        if(this.props.toolbarState.undo === 0){
            // this.props.updateState({
            //     type: 'TOOLBARCHANGE',
            //     data: {undo: 1}
            // })
            this.props.changer.setToolbarState({undo: 1});
        }
        if(!this.current.next){
            // this.props.updateState({
            //     type: 'TOOLBARCHANGE',
            //     data: {redo: 0}
            // })
            this.props.changer.setToolbarState({redo: 0});
        }    

    }
    undo = (subject)=>{
        if(this.current === this.head){
            return;
        }
        this.stopObserving();
        let actions = this.current.change.record;
        for(let i = actions.length - 1; i >= 0; i--){
            let action = actions[i];
            switch(action.type){
                case 'attributes':{
                    let {attributeName: attr, target, oldValue} = action;
                    target[attr] = oldValue;
                    continue;
                }
                case 'characterData':{
                    let {target, oldValue} = action;
                    target.nodeValue = oldValue;
                    continue;
                }
                case 'replaceNode': case 'removeNode': {
                    let {removedNodes, target, previousSibling: prev, nextSibling: next} = action;
                    let r = this.setRange(target, prev, next);
                    this.replaceWithNodeList(r, removedNodes);
                    continue;
                }
                case 'addNode': {
                    let {target, previousSibling: prev, nextSibling: next} = action;
                    let r = this.setRange(target, prev, next);
                    r.deleteContents();
                    continue;
                }    
            }
        }
        this.startObserving();
        this.current = this.current.prev;
        this.reApplyRange(this.current.change.range, subject);
        if(this.props.toolbarState.redo === 0){
            // this.props.updateState({
            //     type: 'TOOLBARCHANGE',
            //     data: {redo: 1}
            // })
            this.props.changer.setToolbarState({redo: 1});
        }
        if(this.current === this.head){
            // this.props.updateState({
            //     type: 'TOOLBARCHANGE',
            //     data: {undo: 0}
            // })
            this.props.changer.setToolbarState({undo: 0});

        }

    }
}
export default HistoryStackManager;