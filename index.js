import React from 'react';
import {connect} from 'react-redux';
import EditorNodeTraveler from './node_traveler';
import HistoryStackManager from './history_manager'
class EditorApp extends React.Component{
    constructor(props){
        super(props);
        this.currentRange = new Range();
        if(props.self){
            this.editorArea = props.editorNode.cloneNode(false);
        }
        else{
            this.editorArea = props.editorNode;
        }
        this.currentRange.setStart(this.editorArea, 0);
        this.currentRange.collapse(true);
        this.data = {
            waitElem: null,
        }
        this.editor_app = React.createRef();
        this.toolbarState = {
            undo: 0,//0 disabled, 1 normal, 2 activated
            redo: 0,
            bold: 1, 
            italic: 1,
            underline: 1,
            order: 1,
            unorder: 1,
            inclevel: 0,
            declevel: 0,
            link: 1,
            quote: 1,
            code: 1,
            img: 1,
            fill: 'yellow',
            color: 'red',
            fontsize: '16px',
            fontfamily: 'Arial,Helvetica,sans-serif'
        };
        this.promptState = {};
        this.changer = {};
        this.historyManager = new HistoryStackManager(this.editorArea)
        this.traveler = new EditorNodeTraveler(this.editorArea, this.changer, this.historyManager, this.toolbarState);
        this.historyManager.props = {
            changer: this.changer,
            toolbarState: this.toolbarState
        };
        this.undo = this.historyManager.undo.bind(this.historyManager, this);
        this.redo = this.historyManager.redo.bind(this.historyManager, this);
    }

    handlePasteData = (e) => {
        let {commonAncestorContainer: common} = this.currentRange;
        let clipboard = e.clipboardData;
        let types = clipboard.types;
        if(types.length === 1 && types[0] === 'Files'){
            e.preventDefault();
            let blob = clipboard.items[0].getAsFile();
            this.handleImage(blob);
            return;
        }
        if(common.parentNode.classList.contains('zero_space')){
            e.preventDefault();
            return;
        }
        if(types.indexOf('text/html') > -1){
            let html = clipboard.getData('text/html');
            if(/(content=Excel\.Sheet)/.test(html)){
                e.preventDefault();
                let div = document.createElement('div');
                div.innerHTML = html;
                let table = div.querySelector('table');
                let fig = this.traveler.createFig(table);
                this.traveler._insertImg(this.currentRange, fig);
                return;
            }
        }
        if(types.indexOf('text/plain') > -1){
            e.preventDefault();
            this.traveler.pastePlainText(this.currentRange, clipboard.getData('text/plain'))
        }
    }
    isBelongTag = (nodeName, node) =>{
        if(node.nodeNome == nodeName) return true;
        while(node != this.editorArea && node.nodeName !== nodeName){
            node = node.parentNode;
        }
        return node.nodeName == nodeName ? true : false;
    }
    restoreRange = ({startContainer, endContainer, startOffset, endOffset}) =>{
        this.currentRange = new Range();
        this.currentRange.setStart(startContainer, startOffset);
        this.currentRange.setEnd(endContainer, endOffset);
    }
    preserveRange(){
        let {startContainer, endContainer, startOffset, endOffset, commonAncestorContainer} = this.currentRange;
        this.preserveRange = {startContainer, endContainer, startOffset, endOffset, commonAncestorContainer};
    }
    isFirst(par, node){
        if(!par || node === par) return true;
        while(node === node.parentNode.firstChild && node !== par && node !== this.root){
            node = node.parentNode;
        }
        return node === par ? node : false;
    }
    isLast(par, node){
        if(!par || node === par) return true;
        while(node === node.parentNode.lastChild && node !== par && node !== this.root){
            node = node.parentNode;
        }
        return node === par ? node : false;
    }
    lastFindOUL = (cur)=>{
        cur = this.traveler.isBelongTag('LI', cur);
        if(!cur) return false;
        let _find;
        return (_find = (cur) =>{
            let par = cur.parentNode;
            if(par.nodeName !== 'UL' && par.nodeName !== 'OL'){
                return cur;
            }
            else if((par.nodeName === 'UL' || par.nodeName === 'OL') && par.lastChild === cur){
                return _find(par);
            }
            return false;
        })(cur)
    }
    firstFindOUL = (cur) => {
        cur = this.traveler.isBelongTag('LI', cur);
        if(!cur) return false;
        let _find;
        return (_find = (cur) =>{
            let par = cur.parentNode;
            if(par.nodeName !== 'UL' && par.nodeName !== 'OL'){
                return cur;
            }
            else if((par.nodeName === 'UL' || par.nodeName === 'OL') && par.firstChild === cur){
                return _find(par);
            }
            return false;
        })(cur)
    }
    handleKeyDown = (e) =>{
        if(e.keyCode === 65 && e.ctrlKey){
            if(this.currentRange.selectNodeContents(this.editorArea));
            return;
        }
        if(e.keyCode === 90){
            if(e.shiftKey && e.ctrlKey){
                e.preventDefault();
                this.redo();
                return;
            }
            else if(e.ctrlKey){
                e.preventDefault();
                this.undo();
                return;
            }
        }
        let sel = document.getSelection();
        if(!sel.rangeCount) return;
        let r = sel.getRangeAt(0);
            if([8, 13, 37, 38, 39, 40].indexOf(e.keyCode) > -1){
                setTimeout(() =>{
                    let s = document.getSelection(), r1;
                    s.rangeCount && this.traveler.checkRange((r1 = s.getRangeAt(0)));
                    e.keyCode !== 13 && r1 && (this.currentRange = r1);
                    
                },0)
            }
        let {startContainer: start, startOffset: off, endOffset: endOff, endContainer: end, collapsed, commonAncestorContainer: common} = r;
        if(common.parentNode.classList.contains('zero_space')){
            if(e.keyCode === 86 && e.ctrlKey || e.keyCode === 32 || e.keyCode === 8 && off !== 0 && common.innerHTML !== '&#65279;'){
                return;
            }
            let spanx = common.parentNode, ctn = spanx.parentNode;
            e.preventDefault();
            if(e.keyCode === 13 && spanx === ctn.firstChild){
                if(ctn.nodeName === 'DIV'){
                    ctn.parentNode.insertBefore(document.createElement('br'), ctn);
                }
                else if(ctn.nodeName === 'LI'){
                    let li = document.createElement('LI');
                    li.appendChild(document.createElement('br'));
                    ctn.parentNode.insertBefore(li, ctn);
                }
            }
            if(e.keyCode === 13 && spanx === ctn.lastChild){
                if(ctn.nodeName === 'DIV'){
                    let br = document.createElement('br');
                    this.traveler.insertAfter(br, ctn);
                    this.currentRange.setStartBefore(br);
                }
                else if(ctn.nodeName === 'LI'){
                    let li = document.createElement('LI');
                    li.appendChild(document.createElement('br'));
                    this.traveler.insertAfter(li, ctn);
                    this.currentRange.setStart(li, 0);
                }
                this.currentRange.collapse(true);
                this.repopulateSelection();
            }
            return;
        }
        if(common.parentNode.classList.contains('cap') || common.classList && common.classList.contains('cap')){
            if(common.nodeName === 'FIGCAPTION'){
                setTimeout(()=>{
                    if(common.firstChild && common.firstChild.nodeName !== 'BR'){
                        common.classList.remove('holder_before');
                    }
                }, 100)
            }
            if(e.keyCode === 8 || e.keyCode === 46 && common.nodeName === '#text'){
                let cap = common.parentNode;
                setTimeout(() =>{
                    if(!cap.hasChildNodes() || !this.traveler.hasRealText(cap)){
                        if(cap.firstChild){
                            cap.firstChild.remove();
                        }
                        !cap.classList.contains('holder_before') && cap.classList.add('holder_before');
                    }
                },100)
            }
            if(e.keyCode === 13 || common.nodeName === '#text' 
            && off === common.nodeValue.length && e.keyCode === 46 
            ||common.nodeName === 'FIGCAPTION' && (e.keyCode === 8 || e.keyCode === 46)){
                e.preventDefault();
                return;
            }
        }
        let li, par;
        li = this.traveler.isBelongTag('LI', start);
        if(e.keyCode === 8){
            let span = this.traveler.isBelongTag('SPAN', common);
            if(span && span === span.parentNode.firstChild){
                if(this.traveler.hasRealText(span)){
                    if(collapsed && off === 1 && start.nodeValue.length === 1 || 
                        !collapsed && off === 0 && start === span.firstChild && endOff === end.nodeValue.length && end === span.lastChild){
                        e.preventDefault();
                        r.selectNodeContents(span);
                        r.deleteContents();
                        if(!span.hasChildNodes()){
                            let br = document.createElement('br');
                            span.appendChild(br);
                        }
                        this.currentRange.setStart(span, 0);
                        this.currentRange.collapse(true);
                    }
                }
                else if(span === span.parentNode.firstChild && span.parentNode.parentNode === this.editorArea.firstChild){
                    e.preventDefault();
                }

            }
            if(r.collapsed && off === 0 && li &&
            this.isFirst(li, start) && li === li.parentNode.firstChild){
                e.preventDefault();
                par = li.parentNode;
                if(par.parentNode.nodeName !== 'UL' || par.parentNode.nodeName !== 'OL'){
                    let p = document.createElement('p');
                    li.remove();
                    r.setStartBefore(par);
                    r.collapse(true);
                    r.insertNode(p);
                    r.selectNodeContents(li);
                    p.appendChild(r.extractContents());
                    this.traveler.handleUnacessedSpan(p.firstChild, true);
                    this.traveler.handleUnacessedSpan(p);
                    r.setStartBefore(p.firstChild)
                    r.collapse(true);
                }
                else{
                    li.remove();
                    par.parentNode.insertBefore(li, par);
                }
                if(!par.hasChildNodes()){
                    par.remove();
                }
            }

        }
        else if(e.keyCode === 13 && (li = this.traveler.isBelongTag('LI', common))){
            par = li.parentNode;
            let grand = par.parentNode;
            !r.collapsed && r.extractContents();
            if(this.traveler.hasRealText(li)){
                if(off === 0 && this.isFirst(li, start) && li === par.firstChild){
                    e.preventDefault();
                    r.setStartBefore(par);
                    r.collapse(true);
                    if(['UL', 'OL'].indexOf(par.parentNode.nodeName) === -1){
                        let br = document.createElement('br');
                        r.insertNode(br);
                    }
                    else{
                        let li1 = document.createElement('li');
                        r.insertNode(li1);
                    }
                    r.setStart(li, 0);
                    r.collapse(true);
                }
                //do nothing
            }
            else if(li === par.firstChild || li === par.lastChild){
                e.preventDefault();
                if(!(this.isBelongTag('UL', par) && this.isBelongTag('OL', par))){
                    let p = document.createElement('p');
                    li === par.firstChild ? r.setStartBefore(par) : r.setStartAfter(par);
                    r.collapse(true);
                    r.insertNode(p);
                    if(li.hasChildNodes()){
                        r.selectNodeContents(li)
                        p.appendChild(r.extractContents())
                    }
                    else {
                        p.appendChild(document.createElement('br'))
                    }
                    r.setStart(p, 0);
                    r.collapse(true);
                    li.remove();
                }
                else{
                    li.remove();
                    li === par.firstChild ? r.setStartBefore(par) : r.setStartAfter(par);
                    r.collapse(true);
                    r.insertNode(li);
                    r.setStart(li, 0);
                    r.collapse(true);
                }
                if(!this.traveler.isRemainLi(par)) par.remove();
            }
            else{
                e.preventDefault();
                r.selectNode(li);
                r.selectNode(this.traveler.splitNodeX(par, r));
                r.deleteContents();
                if(grand.nodeName === 'UL' || grand.nodeName === 'OL'){
                    r.appendChild(li);
                    r.setStart(li, 0);
                }
                else{
                    let p = document.createElement('p');
                    r.insertNode(p);
                    let span;
                    if(li.hasChildNodes() && (span = li.firstChild) && span.nodeName === 'SPAN'){
                        p.appendChild(span);
                        r.setStart(span, 0);
                    }
                    else{
                        p.appendChild(document.createElement('br'));
                        r.setStart(p, 0);
                    }
                }
                r.collapse(true);
            }

        }
        sel.removeAllRanges();
        sel.addRange(r);
        this.rememberRange();
    }
    handleInput = (e) =>{
        setTimeout(() => {
            this.currentRange = this.rememberRange()   
        },0)
    }
    updateRangeFromSelection = () =>{
        setTimeout(()=>{
            this.currentRange = this.rememberRange();
            this.traveler.checkRange(this.currentRange);
        }, 0)
    }
    rememberRange = (range)=>{
        let sel;
        let r = range ? range : (sel = document.getSelection()) && sel.rangeCount ? sel.getRangeAt(0) : false;
        if(r){
            let {startContainer, startOffset, endContainer, endOffset} = r;
            this.historyManager.updateRange({startContainer, startOffset, endContainer, endOffset});                
            return r;
        }
        return this.currentRange;
    }
    cutNode = (range) =>{
        let common = range.commonAncestorContainer, cm;
        if((cm = this.traveler.isBelongTag('A', common) || this.traveler.isBelongTag('SPAN', common) || this.traveler.isBelongTag('#text', common))){
            common = cm;
            let r1 = range.cloneRange();
            r1.setStartBefore(common);
            let ct1 = r1.extractContents()
            let r2 = range.cloneRange();
            r2.setEndAfter(common);
            let ct2 = r2.extractContents()
            if(ct1.firstChild){
                let lst = ct1.lastChild
                r1.insertNode(ct1);
                range.setStartAfter(lst);
                range.collapse(true)
            };
            if(ct2.firstChild){
                let fst = ct2.firstChild;
                if(fst.nodeName === 'A' && !this.traveler.hasRealText(fst)){
                    r1.selectNodeContents(fst);
                    ct2 = r1.extractContents();
                    fst = ct2.firstChild;
                }
                r2.insertNode(ct2);
                range.setStartBefore(fst);
                range.collapse(true);
            }
            common.remove();
            return range;
        }
        else if(common.nodeName === 'P'){
            range.deleteContents();
            return range;
        }
        else if(range.collapsed){
            return range;
        }
        return false;
    }
    handleKeyPress = (e) =>{
        let {waitElem} = this.data;
        let sel = document.getSelection();
        if(!sel.rangeCount) return;
        let r = sel.getRangeAt(0);
        let {startContainer, startOffset, commonAncestorContainer: cm, collapsed} = r;
        if(e.keyCode !== 13 && (startContainer === this.editorArea || startContainer.nodeName === 'BLOCKQUOTE')){
            //wrap p around text content
            !r.collapsed && this.traveler.reassignRange(r) && r.deleteContents();
            let p = document.createElement('p');
            p.appendChild(document.createElement('br'));
            r.insertNode(p);
            if(p.nextSibling && p.nextSibling.nodeName === 'BR'){
                p.nextSibling.remove();
            }
            r.setStart(p,0);
            r.collapse(true)
        }
        if(waitElem && waitElem.parentNode && e.keyCode !== 13){
            e.preventDefault();
            let text = document.createTextNode(e.key);
            waitElem.appendChild(text);
            let par = waitElem.parentNode;
            if(par.childNodes.length === 2 && par.lastChild.nodeName === 'BR'){
                par.lastChild.remove();
            }
            if(par === this.editorArea || par.nodeName === 'BLOCKQUOTE'){
                let p = document.createElement('p');
                par.replaceChild(p, waitElem);
                p.appendChild(waitElem)
            }
            this.currentRange.setStart(text, 1);
            this.currentRange.collapse(true);
            this.repopulateSelection();
            this.data.waitElem = null;
        }
        else if(e.keyCode === 13  && !this.traveler.isBelongTag('LI', startContainer)){
            let block, x;
            if(collapsed && (block = this.traveler.isBelongTag('PRE', cm) || this.traveler.isBelongTag('BLOCKQUOTE', cm))){
                if(startOffset === 0 && this.isFirst(block, startContainer) && (!block.previousSibling || this.traveler.isBlockElem(block.previousSibling))){
                    e.preventDefault();
                    let br = document.createElement('br');
                    block.parentNode.insertBefore(br, block);
                    x = true;
                }
                else if(cm.nodeName !== '#text'){
                    let node = this.traveler.isBelongTag('P', cm, block) || this.traveler.isBelongTag('SPAN', cm, block) || (cm === block && this.traveler.getNthChild(cm, startOffset));
                    let a, b;
                    if(node && node === block.lastChild && !this.traveler.hasRealText(node)){
                        a = true;
                    }
                    if(!block.hasChildNodes() || a && node === block.firstChild){
                        b = true;
                    }
                    if(b){
                        e.preventDefault();
                        !node && (node = document.createElement('br'));
                        block.parentNode.replaceChild(node, block);
                        x = true;
                    }
                    else if(a){
                        e.preventDefault();
                        !node && (node = document.createElement('br'))
                        this.traveler.insertAfter(node, block);
                        x = true;
                    }
                    if(x){
                        if(node.nodeName === 'BR'){
                            r.setStartBefore(node);
                        }
                        else{
                            try{
                                r.setStart(node.firstChild, 0)
                            }
                            catch{
                                r.setStart(node, 0);
                            }
                        }
                    }
                }
                if(x){
                    r.collapse(true);
                    this.currentRange = r;
                    this.repopulateSelection();
                }
            }
            if(!x){
                let range = this.cutNode(r);
                if(range){
                    e.preventDefault();
                    let {startOffset: off, commonAncestorContainer: cm} = range;
                    if(cm.nodeName === 'P'){
                        if(!cm.hasChildNodes() || this.traveler.hasOnlyOneBr(cm)){
                            let br = document.createElement('br');
                            cm.parentNode.replaceChild(br, cm);
                            range.setStartAfter(br);
                            range.collapse(true);
                            this.traveler.insertAfter(document.createElement('br'), br)
                        }
                        else{
                            let p = cm.cloneNode(false);
                            range.setEndAfter(cm.lastChild);
                            this.traveler.insertAfter(p, cm);
                            p.appendChild(range.extractContents());
                            this.traveler.handleUnacessedSpan(cm.lastChild, true);
                            this.traveler.handleUnacessedSpan(p.firstChild, true);
                            this.traveler.handleUnacessedSpan(cm);
                            this.traveler.handleUnacessedSpan(p);
                            p.firstChild && p.firstChild.nodeName !== 'BR' ? range.setStart(p.firstChild, 0) : range.setStart(p, 0);
                            range.collapse(true);
                        }
                    }
                    else{
                        let bef = this.traveler.getNthChild(cm, off - 1);
                        let af = this.traveler.getNthChild(cm, off);
                        bef = this.traveler.handleUnacessedSpan(bef, true);
                        af = this.traveler.handleUnacessedSpan(af, true);
                        let pr,nx,x,y, pre;
                        if(!(pre = this.traveler.isBelongTag('PRE', cm))){
                            if((x = bef && bef.nodeName !== 'BR' && !this.traveler.isBlockElem(bef) && (!(pr = bef.previousSibling) || (pr.nodeName !== '#text' && pr.nodeName !== 'SPAN')))){
                                let p = document.createElement('p');
                                cm.replaceChild(p, bef);
                                p.appendChild(bef);
                                this.traveler.handleUnacessedSpan(p);
                                range.setStartAfter(p);
                                range.collapse(true);
                            }
                            if((y = af && af.nodeName !== 'BR' && !this.traveler.isBlockElem(af) && (!(nx = af.nextSibling) || (nx.nodeName !== '#text' && nx.nodeName !== 'SPAN')))){
                                let p = document.createElement('p');
                                cm.replaceChild(p, af);
                                p.appendChild(af);
                                this.traveler.handleUnacessedSpan(p);
                                range.setStart(p, 0);
                                range.collapse(true);
                            }
                        }
                        if(pre){
                            let br = document.createElement('br');
                            range.insertNode(br);
                            range.collapse(false);
                            if(!br.nextSibling){
                                pre.appendChild(document.createElement('br'));
                            }
                        }
                        else if(!y){
                            if(!x){
                                let br = document.createElement('br');
                                range.insertNode(br);
                                range.collapse(false);
                            }
                            if(af){
                                af.nodeName === 'BR' ? range.setStartBefore(af) : range.setStart(af, 0);
                                range.collapse(true)
                            }
                            else{
                                let br = document.createElement('br');
                                range.insertNode(br);
                                range.collapse(true); 
                            }
                        }                   
                    }
                    this.currentRange = range;
                    this.repopulateSelection();
                }
            }
        }
    }
    repopulateSelection = (bool) =>{
        this.editorArea.focus();
        if(!bool){
            let s = document.getSelection()
            s.removeAllRanges();
            s.addRange(this.currentRange);
        }
        this.traveler.checkRange(this.currentRange);
        setTimeout(() =>{
            this.rememberRange(this.currentRange)
        },0)
    }
    changeStyle = ({prop, val}) =>{
        if(!this.currentRange || this.toolbarState.bold === 0) return;
        let state = this.toolbarState;
        (prop === 'fontWeight' && state.bold === 2 ||
        prop === 'fontStyle' && state.italic === 2 ||
        prop === 'textDecoration' && state.underline === 2) && (val = '');
        if(this.data.waitElem){
            this.data.waitElem.style[prop] = val; // add more style to waiting span element
            this.repopulateSelection();
            return;
        }
        this.currentRange = this.traveler.modify(this.currentRange,{
            prop,
            val
        }).cloneRange();
        let {commonAncestorContainer: common} = this.currentRange;
        if(this.currentRange.collapsed && common.nodeName === 'SPAN' && !common.hasChildNodes()){
            this.data.waitElem = common;
            this.repopulateSelection(true);
        }
        else{
            this.repopulateSelection();
        }

    }
    handleClickBold = (e)=>{
        this.changeStyle({prop: 'fontWeight', val: 'bold'});
    }
    handleClickItalic = (e) =>{
       this.changeStyle({prop: 'fontStyle', val: 'italic'}); 
    }
    handleClickUnderline = (e) =>{
        this.changeStyle({prop: 'textDecoration', val: 'underline'})
    }
    handleClickFontColor = (e) =>{
        let target = e.target;
        let colr = target.firstChild ? target.firstChild.style.color : target.tagName === 'I' ? target.style.color : target.style.backgroundColor;
        this.changeStyle({prop: 'color', val: colr})
    }
    handleSelectFontColor = (e) =>{
        let target = e.target;
        this.changeStyle({prop: 'color', val: target.value});
        this.changer.setToolbarState({color: target.value});
    }
    handleBgroundColor = (e) =>{
        let target = e.target;
        let val = target.value ? target.value : target.firstChild ? target.firstChild.style.backgroundColor : target.style.backgroundColor;
        this.changeStyle({prop: 'backgroundColor', val});
        if(target.value){
            this.changer.setToolbarState({fill: target.value});
        }
    }
    handleFont = (e) =>{
        let target = e.target;
        this.changeStyle({prop: 'fontFamily', val: target.value});
    }
    handleFontSize = (e) =>{
        let target = e.target;
        this.changeStyle({prop: 'fontSize', val: target.value});
    }
    handleClickUList = () =>{
        if(!this.currentRange) return;
        if(this.toolbarState.unorder === 2){
            return this.handleUnList()
        }
        if(this.data.waitElem){
            this.data.waitElem = null;
        }
        this.currentRange = this.traveler.convertToListX('UL', this.currentRange).cloneRange();
        this.repopulateSelection();
    }
    handleClickOList = () =>{
        if(!this.currentRange) return;
        if(this.toolbarState.order === 2){
            return this.handleUnList()
        }
        if(this.data.waitElem){
            this.data.waitElem = null;
        }
        this.currentRange = this.traveler.convertToListX('OL', this.currentRange).cloneRange();
        this.repopulateSelection();
    }
    handleIncreaseListLevel = ()=>{
        if(!this.currentRange) return;
        let state = this.toolbarState;
        if(state.inclevel === 1){
            let type = state.unorder === 2 ? 'UL' : 'OL';
            this.currentRange = this.traveler.increaseListLevel(this.currentRange, type);
            this.repopulateSelection();
        }
    }
    handleDecreaseListLevel = () =>{
        if(!this.currentRange) return;
        let state = this.toolbarState;
        if(state.declevel === 1){
            this.currentRange = this.traveler.decreaseListLevel(this.currentRange);
            this.repopulateSelection();
        }
    }
    handleUnList = () =>{
        if(this.toolbarState.declevel === 1){
            return this.handleDecreaseListLevel();
        }
        else{
            this.currentRange = this.traveler.unlistMany(this.currentRange);
            this.repopulateSelection();
        }
    }
    handleBlockquote = () =>{
        if(!this.currentRange) return;
        if(this.toolbarState.quote === 2){
            this.currentRange = this.traveler.unQuote(this.currentRange);
        }
        else{
            this.currentRange = this.traveler.convertToBLockquote(this.currentRange);
        }
        this.repopulateSelection()
    }
    handleBlockCode = () =>{
        if(!this.currentRange) return;
        if(this.toolbarState.code === 2){
            this.currentRange = this.traveler.unCode(this.currentRange);
        }
        else{
            this.currentRange = this.traveler.convertToBlockCode(this.currentRange);
        }
        this.repopulateSelection()
    }
    handleLink = () =>{
        let {link} = this.toolbarState;
        if(link === 0){
            return;
        }
        let p;
        if(link === 2){
            p = this.traveler.changeOrUnlink(this.currentRange);
        }
        else if(link === 1){
            p = this.traveler.convertToLink(this.currentRange);
        }
        p.then((r) =>{
            this.currentRange = r;
            this.repopulateSelection();
        })
    }
    upImgToCDN(blob){
        let url = 'https://api.cloudinary.com/v1_1/dzhxc8wal/image/upload';
        let formData = new FormData();
        formData.append('file', blob);
        formData.append('upload_preset', 'a9wxjomb')
        return fetch(url,{
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
    }
    handleImage = (blob) =>{
        let {img} = this.toolbarState;
        if(img === 0){
            return;
        }
        let name;
        if(!(blob instanceof Blob)){
            img = this.editor_app.current.querySelector('.img_px');
            name = img.value.match(/.+[\\\/](.+)$/)[1];
            blob = img.files[0];
        }
        !name && (name = 'default');
        this.upImgToCDN(blob).then(data =>{
            if(data.url){
                this.traveler.insertImage(this.currentRange, data.url, name);
            }
            else{
                throw new Error('failed')
            }
        })
        .catch(() =>{
            this.traveler.insertImage(this.currentRange, blob, name);
        })

    }
    handleMouseDown = (e) =>{
        if(this.promptState.showPrompt){
            let {it, as} = this.promptState;
            !as && it.next(false);
            this.changer.setPromptState({showPrompt: false})
        }
    }
    shouldComponentUpdate(nextProps){
        this.toolbarState = Object.assign(this.toolbar, nextProps.toolbarState);
        return false;
    }
    componentDidMount(){
        let {editorArea: editor} = this
        let app = this.editor_app.current;
        let toolbar = app.querySelector('.tool_bar');
        toolbar.onselectstart = (e) =>{
            e.preventDefault();
        }
        app.appendChild(editor);
        editor.onselectstart = ()=>{
            this.data.waitElem && (this.data.waitElem.remove(), this.data.waitElem = null);
        }
        editor.onmouseup = this.updateRangeFromSelection;
        editor.onkeypress = this.handleKeyPress;
        editor.onkeydown = this.handleKeyDown;
        editor.oninput = this.handleInput;
        editor.onmousedown = this.handleMouseDown;
        editor.onpaste = this.handlePasteData;
        this.historyManager.startObserving();
        if(!this.props.focus){
            editor.focus();
        }
        window.scrollTo(0, 0)
    }
    render(){
        let click = {
            undo: this.undo,
            redo: this.redo,
            handleClickBold: this.handleClickBold,
            handleClickItalic: this.handleClickItalic,
            handleClickUnderline: this.handleClickUnderline,
            handleBgroundColor: this.handleBgroundColor,
            handleClickFontColor: this.handleClickFontColor,
            handleSelectFontColor: this.handleSelectFontColor,
            handleFont: this.handleFont,
            handleFontSize: this.handleFontSize,
            handleClickUList: this.handleClickUList,
            handleClickOList: this.handleClickOList,
            handleIncreaseListLevel: this.handleIncreaseListLevel,
            handleDecreaseListLevel: this.handleDecreaseListLevel,
            handleBlockquote: this.handleBlockquote,
            handleBlockCode: this.handleBlockCode,
            handleLink: this.handleLink,
            handleImage: this.handleImage,
        }
        let self = this;
        class ToolBar extends React.Component{
            constructor(props){
                super();
                this.toolbar = React.createRef();
                this.state = self.toolbarState;
                this.fontSizes = [8,9,10,11,12,14,16,18,20,24,28,32,38,46,54,62,72];
                this.fontFams = [];
                [
                    'Georgia,serif',
                    '"Palatino Linotype","Book Antiqua",Palatino,serif',
                    '"Times New Roman",Times,serif',
                    'Arial,Helvetica,sans-serif',
                    '"Arial Black",Gadget,sans-serif',
                    '"Comic Sans MS",cursive,sans-serif',
                    'Impact,Charcoal,sans-serif',
                    '"Lucida Sans Unicode","Lucida Grande",sans-serif',
                    'Tahoma,Geneva,sans-serif',
                    '"Trebuchet MS",Helvetica,sans-serif',
                    'Verdana,Geneva,sans-serif',
                    '"Courier New",Courier,monospace',
                    '"Lucida Console",Monaco,monospace'
                ].map(val =>{
                    this.fontFams.push({
                        font: {fontFamily: val},
                        name: val.match(/\b([\w\s]+)/)[1]
                    });
                });
            }
            selectFile = (e) =>{
                if(this.state.img !== 0){
                    let img =  this.toolbar.current.querySelector('.img_px')
                    img.click();
                }
            }
            componentDidMount(){
                self.changer.setToolbarState = (state, cb) =>{
                    this.setState(state, cb)
                }
                Object.assign(self.toolbarState, this.state)
            }
            shouldComponentUpdate(nextProps, nextState){
                Object.assign(self.toolbarState, nextState);
                return true;
            }
            render(){
                let {click} = this.props, state = this.state;
                let emptyFontStyle = state.fontfamily === 'false' ? {display: 'none'} : {display: 'block'};
                let emptySizeStyle = state.fontsize === 'false' ? {display: 'none'} : {display: 'block'};
                let sizeOpts = this.fontSizes.map((cur, idx) =>(<option key = {idx} value = {`${cur}px`}>{cur}</option>));
                let fontOpts = this.fontFams.map((cur, idx) =>{
                    return <option key = {idx} value = {cur.font.fontFamily} style = {cur.font}>{cur.name}</option>
                })
                return (
                    <div className = 'tool_bar' ref = {this.toolbar}>
                        <div onClick = {click.undo} className = {state.undo ? '' : 'disabled'}><i className="fa fa-reply"></i></div>
                        <div onClick = {click.redo} className = {state.redo ? 'space' : 'space disabled'}><i className="fa fa-share"></i></div>
                        <div onClick = {click.handleClickBold} className = {state.bold === 0 ? 'disabled' : state.bold === 2 ? 'activated' : ''}><i className="fa fa-bold"></i></div>
                        <div onClick = {click.handleClickItalic} className = {state.italic === 0 ? 'disabled' : state.italic === 2 ? 'activated' : ''}><i className="fa fa-italic"></i></div>
                        <div onClick = {click.handleClickUnderline} className = {state.underline === 0 ? 'space disabled' : state.underline === 2 ? 'space activated' : 'space'}><i className="fa fa-underline"></i></div>
                        <div onClick = {click.handleClickUList} className = {state.unorder === 2 ? 'activated' : ''}><i className="fa fa-list-ul"></i></div>
                        <div onClick = {click.handleClickOList} className = {state.order === 2 ? 'activated' : ''}><i className="fa fa-list-ol"></i></div>
                        <div onClick = {click.handleIncreaseListLevel} className = {state.inclevel === 0 ? 'disabled' : ''}><i className="fa fa-indent"></i></div>
                        <div onClick = {click.handleDecreaseListLevel} className = {state.declevel === 0 ? 'space disabled' : 'space'}><i className="fa fa-outdent"></i></div>
                        <div onClick = {click.handleBlockquote} className = {state.quote === 2 ? 'activated' : ''}><i className="fa fa-quote-left"></i></div>
                        <div onClick = {click.handleBlockCode} className = {state.code === 0 ? 'disabled' : state.code === 2 ? 'activated' : ''}><i className="fa fa-code"></i></div>
                        <div className = {state.img === 0 ? 'disabled' : ''}>
                            <i className= "fa fa-file-image-o i-wrapper" onClick = {this.selectFile}>
                                <input type = 'file' name = 'img' className = 'img_px' accept = 'image/*' onInput = {click.handleImage}/>
                            </i>
                        </div>                
                        <div onClick = {click.handleLink}  className = {state.link === 0 ? 'disabled space' : state.link === 2 ? 'activated space' : 'space'}><i className="fa fa-link"></i></div>
                        <div className = {state.bold === 0 ? 'disabled ctn colr' : 'ctn colr'}>
                            <div className = 'prev-i' onClick = {click.handleBgroundColor}>
                                <i className="fa fa-font" style = {{backgroundColor: state.fill}}></i>
                                <div style = {{backgroundColor: state.fill}}></div>
                            </div>
                            <i className="fa fa-caret-down i-wrapper">
                                <input type = 'color' className = 'color-select' onInput = {click.handleBgroundColor}/>
                            </i>
                        </div>
                        <div className = {state.bold === 0 ? 'disabled ctn colr space' : 'ctn colr space'}>
                            <div className = 'prev-i' onClick = {click.handleClickFontColor}>
                                <i className="fa fa-font" style = {{color: state.color}}></i>
                                <div style = {{backgroundColor: state.color}}></div>
                            </div>
                            <i className="fa fa-caret-down i-wrapper">
                                <input type = 'color' className = 'color-select' onInput = {click.handleSelectFontColor}/>
                            </i>
                        </div>
                        <div className = 'ctn select'>
                            <select onChange = {click.handleFont} value = {state.fontfamily} >
                                {fontOpts}
                                {state.fontfamily === 'false' ? <option value = 'false' style = {emptyFontStyle}></option> : ''}
                            </select>
                            <select onChange = {click.handleFontSize} value = {state.fontsize}>
                                {sizeOpts}
                                {state.fontsize === 'false' ? <option value = 'false' style = {emptySizeStyle}></option> : ''}
                            </select>
                        </div>
                    </div>
                )
            }
        }
        class LinkPrompt extends React.Component{
            constructor(props){
                super(props);
                this.state = {
                    showPrompt: false,
                    urlValidated: false,
                    url: '',
                    as: null,
                    it: null,
                }
                this.prompt = React.createRef();
            }
            validatedUrl = (text) => {
                if(text[text.length - 1]) text = text + '/';
                return /[(http(s)?):\/\/(www\.)?a-zA-Z0-9@:%._\+~#=]{2,256}((:[0-9]{1,5}\b)?(\.[a-z]{2,6}\b)|(?!(\.[a-z]{2,6}\b))(:[0-9]{1,5}\b)[^\.])([-na-zA-Z0-9@:%_\+.~#?&//=]*)?/ig.test(text);
            }
            link = () =>{
                let {it} = this.state;
                it && it.next(this.state.url)
                this.setState({showPrompt: false});
            }
            unlink = () =>{
                let {it} = this.state;
                it && it.next(false);
                this.setState({showPrompt: false});
            }
            handleChange = (e) =>{
                let text = e.target.value;
                if(this.validatedUrl(text)){
                    this.setState({
                        url: text,
                        urlValidated: true
                    })
                }
                else this.setState({
                    url: text,
                    urlValidated: false
                })
            }
            componentDidMount(){
                self.changer.setPromptState = (state, cb) =>{
                    this.setState(state, cb)
                }
                Object.assign(self.promptState, this.state);
            }
            shouldComponentUpdate(nextProps, nextState){
                Object.assign(self.promptState, nextState);
                return true;
            }
            render(){
                let {showPrompt} = this.state;
                let style = {
                    position: 'sticky',
                    top: '29px',
                    display: showPrompt ? 'flex' : 'none',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    zIndex: 1,
                    marginBottom: '3px',
                    backgroundColor: 'white'
                }
                let inputStyle = {
                    backgroundColor: this.state.urlValidated ? '#9fdf9f' : '#ffbb99',
                    opacity: this.state.urlValidated ? 1 : 0.5,
                    outline: 'none',
                    border: 'solid 1px grey',
                    borderRadius: '3px',
                    widthMin: '100px',
                }
                setTimeout(()=>{
                    this.prompt.current.querySelector('input').focus();
                },100);
                return (
                    <div className = 'link_prompt' style = {style} ref = {this.prompt}>
                        <input type = 'url' value = {this.state.url} style = {inputStyle} onChange = {this.handleChange} autoFocus = {true}/>
                        <button onClick = {this.link} disabled = {this.state.urlValidated ? false : true} className = 'btn_blue'>link</button>
                        <button onClick = {this.unlink} className = 'btn_orange'>unlink</button>
                    </div>
                )
            }
        }
        return (
            <div className = 'editor_app' ref = {this.editor_app} id = {this.props.id ? this.props.id : ''}>
                <div className = 'editor_head'>
                    <ToolBar click = {click}/>
                    <LinkPrompt/>
                </div>
            </div>
        )
    }

}
function mapstateToProps(state){
    return {
        editorNode: state.editor.editorNode,
    }
}
export default connect(mapstateToProps, null)(EditorApp);