
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
	if(!j2cStore[name]){
		j2cStore[name] = { cssObj:cssObj, version:0, sheet:j2c.sheet(cssObj) };
	} else {
		var styleObj = j2cStore[name]
		_merge( styleObj.cssObj, cssObj )
		styleObj.sheet = j2c.sheet(styleObj.cssObj);
		styleObj.version++
		if( styleObj.dom ) m.redraw()
	}
	return j2cStore[name];
}
m_j2c.remove = function(name, cssObj) {
	var styleObj = j2cStore[name];
	if(!cssObj){
		delete j2cStore[name]
		m.redraw()
	}else{
		_exclude(styleObj.cssObj, cssObj);
		styleObj.sheet = j2c.sheet(styleObj.cssObj);
		styleObj.version++
		if( styleObj.dom ) m.redraw()
	}
	return styleObj
}
window.mm = m_j2c;


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
			m('div', [
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

