var j2c = require('j2c')
var importer = require('j2c-importer')
var m = require('mithril')
var _merge = require('lodash.merge')

// var obj = importer.toJ2c('a {background-color: red;}', { format:'json', case:'camel'} )
// console.log( JSON.stringify(obj) )


function _exclude(source, dest){
	_merge(source, dest, function(a,b,key) {
		if( typeof b!='object' && b ) return null;
	});
	return source;
}
// check if the given object is HTML element
function isElement(o){return (typeof HTMLElement === "object" ? o instanceof HTMLElement :o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName==="string"); }

function stylize(element, sheet){
    element.type = 'text/css';
    if (element.styleSheet){
    	element.styleSheet.cssText = sheet;
    } else {
    	// empty all style when re-apply new style
    	while(element.firstChild) element.removeChild(element.firstChild);
    	element.appendChild(document.createTextNode(sheet));
    }
    return element;
}

function addStyleToHead(styleObj){
	if(!styleObj.dom){
		var el = document.createElement('style')
		document.head.appendChild(el)
		styleObj.dom = el
	}
	styleObj.dom.setAttribute('data-version', 'head_'+styleObj.version)
	stylize(styleObj.dom, styleObj.sheet)
}

var intervdom = function (sheet, vdom){
	if(vdom.attrs&&vdom.attrs.className){
		vdom.attrs.className = vdom.attrs.className.split(/\s+/).map(function(c){
			var g = c.match(/global\((.*)\)/);
			if(g) return g.pop();
			if(sheet[c]) return sheet[c];
			return c
		}).join(' ')
	}
	if(vdom.children) vdom.children.forEach(intervdom)
	return vdom
}
var applyStyle = function(sheet, vdom){
	if( {}.toString.call(vdom)=="[object Array]" ) return vdom.map( function(v){ return applyStyle(sheet, v) } );
	return [intervdom(sheet, vdom)]
}

var j2cStore = {}
function m_j2c(name, vdom) {
	// usage: m_j2c() will return all j2cStore
	if(!name) return j2cStore;
	if( isElement(name) ) return m_j2c.applyDom.apply(this, arguments);
	var styleObj = j2cStore[name]
	// usage: m_j2c('name') will return all j2cStore['name']
	if(!vdom) return styleObj;
	// usage: m_j2c('name', mithril_v_dom) will add style to vdom and create <style> for it, cache style_dom
	if( !styleObj || !styleObj.sheet ) return applyStyle({}, vdom);
	var sheet = styleObj.sheet;
	var styleDom = m('style', {
		config:function(el, isinit, context, vdom){
			if(!isinit) {
                stylize(el, sheet);
                styleObj.dom = el;
            }
		}
	});
	styleDom.attrs[ 'data-'+name+'_'+styleObj.version ] = true;
	return [ styleDom, applyStyle(sheet, vdom) ]
}

m_j2c.add = function( name, cssObj ) {
	if(!name)return;
	var styleObj
	var isHead = name.indexOf('<head')===0;
	if(!j2cStore[name]){
		styleObj = j2cStore[name] = { cssObj:cssObj, version:0, sheet:j2c.sheet(cssObj) };
	} else {
		styleObj = j2cStore[name]
		_merge( styleObj.cssObj, cssObj )
		styleObj.sheet = j2c.sheet(styleObj.cssObj);
		styleObj.version++
	}
	if( isHead ) addStyleToHead(styleObj)
	else if( styleObj.dom ) m.redraw();

	return j2cStore[name];
}
m_j2c.remove = function(name, cssObj) {
	if(!name)return;
	var isHead = name.indexOf('<head')===0;
	var styleObj = j2cStore[name];
	if(!cssObj){
		delete j2cStore[name]
	}else{
		_exclude(styleObj.cssObj, cssObj);
		styleObj.sheet = j2c.sheet(styleObj.cssObj);
		styleObj.version++
	}
	if( isHead ) {
		cssObj
		? addStyleToHead(styleObj)
		: styleObj.dom&&styleObj.dom.parentNode.removeChild(styleObj.dom)
	}
	else if( styleObj.dom ) m.redraw();

	return styleObj
}
m_j2c.getClass = function (nameRegex){
	var sheet, list = {}
	for(var i in j2cStore){
		// tutpoint: string.match(undefined) ?
		if( (sheet=j2cStore[i].sheet) && i.match(nameRegex) ){
			for(var name in sheet){ if(sheet.hasOwnProperty(name)&& !name.match(/^\d/) ) list[name]=sheet[name] }
		}
	}
	// console.log(list)
	return list;
}
m_j2c.applyClass = function (target, nameRegex){
	var list = m_j2c.getClass(nameRegex)
	var _addClassToDom = function(dom){
		var c = dom.className&&dom.className.split(/\s+/)
	    if(c) dom.className = c.map(function(v){ return list[v]||v }).join(' ')
	}
	if( !isElement(target) ) return;
	_addClassToDom(target)
	var items = target.getElementsByTagName("*")
	for (var i = items.length; i--;) {
	    _addClassToDom(items[i])
	}
}

window.mm = m_j2c;


m_j2c.add( '<head abc>', {' body':{font_size:'10px', }} )
m_j2c.add( '<head def>', {' body':{color:'red', ' .text':{color:'blue'} }  } )

function Converter () {
	var self = this;
	self.cssObj= {
		'.half': {
			position:'absolute',
			top:'30px',
			left:0,
			width:'50%',
			height:'90%',
			' textarea':{
				color:'#333333',
				width:'100%',
				height:'100%',
			}
		},
		'@global':{
			' html, body':{
				height:'100%'
			},
			'.output':{
				left:'50%'
			}
		},
	}
	self.controller=function(){
		this.options = {format:'json', beautify:true, indent:2, case:'camel'}
		this.inputStr = ''
		this.outputStr = ''
		this.update = function(str){
			if(str) this.inputStr = str;
			this.outputStr = importer.toJ2c( this.inputStr , this.options );
			m.redraw()
		}
		m_j2c.add('body_style', self.cssObj )
	}
	self.view = function(ctrl){
		var dom = m_j2c('body_style',  [
			m('div.global(text)', [
				m('span', 'Convert style sheet from left to right below:'),
				m('select',
					{oninput:function(){ ctrl.options.case = this.value; ctrl.update() }},
					'camel|snake|dash'.split('|').map(function(v){ return m('option', {value:v, selected:v==ctrl.options.case?true:false }, v) })
				),
			]),
			m('.global(input).half', {className:'abc def'}, [
				m('textarea', {oninput:function(){ ctrl.update( this.value ) }} ),
			]),
			m('.global(output).half', [
				m('textarea', {}, JSON.stringify(ctrl.outputStr) )
			]),
		])
		return dom;
	}
}

m.mount(document.body, new Converter() )

