// ========================================================================
// SproutCore
// copyright 2006-2008 Sprout Systems, Inc.
// ========================================================================

require('core');
require('system/core_query') ;

/**
  The event class provides a simple cross-platform library for capturing and
  delivering events on DOM elements and other objects.  While this library
  is based on code from both jQuery and Prototype.js, it includes a number of
  additional features including support for handler objects and event 
  delegation.

  Since native events are implemented very unevenly across browsers,
  SproutCore will convert all native events into a standardized instance of
  this special event class.  
  
  SproutCore events implement the standard W3C event API as well as some 
  additional helper methods.

  @constructor
  @param {Event} originalEvent
  @returns {SC.Event} event instance
  
  @since SproutCore 1.0
*/
SC.Event = function(originalEvent) { 

  // copy properties from original event, if passed in.
  if (originalEvent) {
    this.originalEvent = originalEvent ;
    var props = SC.Event._props, len = props.length, idx = len ;
    while(--idx >= 0) {
      var key = props[idx] ;
      this[key] = originalEvent[key] ;
    }
  }

  // Fix timeStamp
  this.timeStamp = this.timeStamp || Date.now();

  // Fix target property, if necessary
  // Fixes #1925 where srcElement might not be defined either
  if (!this.target) this.target = this.srcElement || document; 

  // check if target is a textnode (safari)
  if (this.target.nodeType == 3 ) this.target = this.target.parentNode;

  // Add relatedTarget, if necessary
  if (!this.relatedTarget && this.fromElement) {
    this.relatedTarget = (this.fromElement === this.target) ? this.toElement : this.fromElement;
  }

  // Calculate pageX/Y if missing and clientX/Y available
  if ( this.pageX == null && this.clientX != null ) {
    var doc = document.documentElement, body = document.body;
    this.pageX = this.clientX + (doc && doc.scrollLeft || body && body.scrollLeft || 0) - (doc.clientLeft || 0);
    this.pageY = this.clientY + (doc && doc.scrollTop || body && body.scrollTop || 0) - (doc.clientTop || 0);
  }

  // Add which for key events
  if (!this.which && ((this.charCode || originalEvent.charCode === 0) ? this.charCode : this.keyCode)) {
    this.which = this.charCode || this.keyCode;
  }

  // Add metaKey to non-Mac browsers (use ctrl for PC's and Meta for Macs)
  if (!this.metaKey && this.ctrlKey) this.metaKey = this.ctrlKey;

  // Add which for click: 1 == left; 2 == middle; 3 == right
  // Note: button is not normalized, so don't use it
  if (!this.which && this.button) {
    this.which = (this.button & 1 ? 1 : ( this.button & 2 ? 3 : ( this.button & 4 ? 2 : 0 ) ));
  }
  
  return this; 
} ;

SC.mixin(SC.Event, /** @scope SC.Event */ {

  /** 
    Standard method to create a new event.  Pass the native browser event you
    wish to wrap if needed.
  */
  create: function(e) { return new SC.Event(e); },

  // the code below was borrowed from jQuery, Dean Edwards, and Prototype.js
  
  /**
    Bind an event to an element.

    This method will cause the passed handler to be executed whenever a
    relevant event occurs on the named element.  This method supports a
    variety of handler types, depending on the kind of support you need.
    
    h2. Simple Function Handlers
    
      SC.Event.add(anElement, "click", myClickHandler) ;
      
    The most basic type of handler you can pass is a function.  This function
    will be executed everytime an event of the type you specify occurs on the
    named element.  You can optionally pass an additional context object which
    will be included on the event in the event.data property.
    
    When your handler function is called the, the function's "this" property
    will point to the element the event occurred on.
    
    The click handler for this method must have a method signature like:
    
      function(event) { return YES|NO; }
      
    h2. Method Invocations
    
      SC.Event.add(anElement, "click", myObject, myObject.aMethod) ;
      
    Optionally you can specify a target object and a method on the object to 
    be invoked when the event occurs.  This will invoke the method function
    with the target object you pass as "this".  The method should have a 
    signature like:
    
      function(event, targetElement) { return YES|NO; }
      
    Like function handlers, you can pass an additional context data paramater
    that will be included on the event in the event.data property.
      
    h2. Handler Return Values
    
    Both handler functions should return YES if you want the event to 
    continue to propagate and NO if you want it to stop.  Returning NO will
    both stop bubbling of the event and will prevent any default action 
    taken by the browser.  You can also control these two behaviors separately
    by calling the stopPropogation() or preventDefault() methods on the event
    itself, returning YES from your method.
    
    h2. Limitations
    
    Although SproutCore's event implementation is based on jQuery, it is 
    much simpler in design.  Notably, it does not support namespaced events
    and you can only pass a single type at a time.
    
    If you need more advanced event handling, consider the SC.ClassicResponder 
    functionality provided by SproutCore or use your favorite DOM library.

    @param {Element} elem a DOM element, window, or document object
    @param {String} eventType the event type you want to respond to
    @param {Object} target The target object for a method call or a function.
    @param {Object} method optional method or method name if target passed
    @param {Object} context optional context to pass to the handler as event.data
    @returns {Object} receiver
  */
  add: function(elem, eventType, target, method, context) {
    
    // cannot register events on text nodes, etc.
    if ( elem.nodeType == 3 || elem.nodeType == 8 ) return SC.Event;

    // For whatever reason, IE has trouble passing the window object
    // around, causing it to be cloned in the process
    if (SC.browser.msie && elem.setInterval) elem = window;

    // if target is a function, treat it as the method, with optional context
    if (SC.typeOf(target) === SC.T_FUNCTION) {
      context = method; method = target; target = null;
      
    // handle case where passed method is a key on the target.
    } else if (target && SC.typeOf(method) === SC.T_STRING) {
      method = target[method] ;
    }

    // Get the handlers queue for this element/eventType.  If the queue does
    // not exist yet, create it and also setup the shared listener for this
    // eventType.
    var events = SC.data(elem, "events") || SC.data(elem, "events", {}) ;
    var handlers = events[eventType]; 
    if (!handlers) {
      handlers = events[eventType] = {} ;
      this._addEventListener(elem, eventType) ;
    }
    
    // Build the handler array and add to queue
    handlers[SC.guidFor(method)] = [target, method, context];
    SC.Event._global[eventType] = YES ; // optimization for global triggers

    // Nullify elem to prevent memory leaks in IE
    elem = events = handlers = null ;
    return this ;
  },

  /**
    Removes a specific handler or all handlers for an event or event+type.

    To remove a specific handler, you must pass in the same function or the
    same target and method as you passed into SC.Event.add().  See that method
    for full documentation on the parameters you can pass in.
    
    If you omit a specific handler but provide both an element and eventType,
    then all handlers for that element will be removed.  If you provide only
    and element, then all handlers for all events on that element will be
    removed.
    
    h2. Limitations
    
    Although SproutCore's event implementation is based on jQuery, it is 
    much simpler in design.  Notably, it does not support namespaced events
    and you can only pass a single type at a time.
    
    If you need more advanced event handling, consider the SC.ClassicResponder 
    functionality provided by SproutCore or use your favorite DOM library.
    
    @param {Element} elem a DOM element, window, or document object
    @param {String} eventType the event type to remove
    @param {Object} target The target object for a method call.  Or a function.
    @param {Object} method optional name of method
    @returns {Object} receiver
  */
  remove: function(elem, eventType, target, method) {
    
    // don't do events on text and comment nodes
    if ( elem.nodeType == 3 || elem.nodeType == 8 ) return SC.Event;

    // For whatever reason, IE has trouble passing the window object
    // around, causing it to be cloned in the process
    if (SC.browser.msie && elem.setInterval) elem = window;

    var handlers, key, events = SC.data(elem, "events") ;
    if (!events) return this ; // nothing to do if no events are registered

    // if no type is provided, remove all types for this element.
    if (eventType == undefined) {
      for(eventType in events) this.remove(elem, eventType) ;

    // otherwise, remove the handler for this specific eventType if found
    } else if (handlers = events[eventType]) {

      var cleanupHandlers = NO ;
      
      // if a target/method is provided, remove only that one
      if (target || method) {
        
        // normalize the target/method
        if (SC.typeOf(target) === SC.T_FUNCTION) {
          method = target; target = null ;
        } else if (SC.typeOf(method) === SC.T_STRING) {
          method = target[method] ;
        }
        
        delete events[SC.guidFor(method)] ;
        
        // check to see if there are handlers left on this event/eventType.
        // if not, then cleanup the handlers.
        key = null ;
        for(var key in handlers) break ;
        if (key == null) cleanupHandlers = YES ;

      // otherwise, just cleanup all handlers
      } else cleanupHandlers = YES ;
      
      // If there are no more handlers left on this event type, remove 
      // eventType hash from queue.
      if (cleanupHandlers) {
        delete events[eventType] ;
        this._removeEventListener(elem, eventType) ;
      }
      
      // verify that there are still events registered on this element.  If 
      // there aren't, cleanup the element completely to avoid memory leaks.
      key = null ;
      for(key in events) break;
      if(!key) {
        SC.removeData(elem, "events") ;
        delete this._elements[SC.guidFor(elem)]; // important to avoid leaks
      }
      
    }
    
    elem = events = handlers = null ; // avoid memory leaks
    return this ;
  },

  /**
    Trigger an event execution immediately.  You can use this method to 
    simulate arbitrary events on arbitary elements.

    h2. Limitations
    
    Note that although this is based on the jQuery implementation, it is 
    much simpler.  Notably namespaced events are not supported and you cannot
    trigger events globally.
    
    If you need more advanced event handling, consider the SC.ClassicResponder 
    functionality provided by SproutCore or use your favorite DOM library.

    @param elem {Element} the target element
    @param eventType {String} the event type
    @param args {Array} optional argument or arguments to pass to handler.
    @param donative ??
    @returns {Boolean} Return value of trigger or undefined if not fired
  */
  trigger: function(elem, eventType, args, donative) {

    // don't do events on text and comment nodes
    if ( elem.nodeType == 3 || elem.nodeType == 8 ) return undefined;
    
    // Normalize to an array
    args = SC.$A(args) ;

    var ret, fn = SC.typeOf(elem[eventType] || null) === T_FUNCTION ;

    // Get the event to pass, creating a fake one if necessary
    var event = args[0];
    if (!event || !event.preventDefault) {
      event = {
        type: eventType,
        target: elem,
        preventDefault: function(){},
        stopPropagation: function(){},
        timeStamp: Date.now(),
        normalized: YES
      } ;
      args.unshift(event) ;
    }

    event.type = eventType ;

    // Trigger the event
    ret = SC.Event.handle.apply(elem, args) ;

    // Handle triggering native .onfoo handlers
    var onfoo = elem["on" + eventType] ;
    var isClick = SC.CoreQuery.nodeName(elem, 'a') && eventType === 'click';
    if ((!fn || isClick) && onfoo && onfoo.apply(elem, args) === NO) ret = NO;

    // Trigger the native events (except for clicks on links)
    if (fn && donative !== NO && ret !== NO && !isClick) {
      this.triggered = YES;
      try {
        elem[ eventType ]();
      // prevent IE from throwing an error for some hidden elements
      } catch (e) {}
    }
    
    this.triggered = NO;

    return ret;
  },

  /**
    This method will handle the passed event, finding any registered listeners
    and executing them.  If you have an event you want handled, you can 
    manually invoke this method.  This function expects it's "this" value to
    be the element the event occurred on, so you should always call this 
    method like:
    
      SC.Event.handle.call(element, event) ;
      
    Note that like other parts of this library, the handle function does not
    support namespaces.
    
    @param event {Event} the event to handle
    @returns {Boolean}
  */
  handle: function(event) {

    // ignore events triggered after window is unloaded or if double-called
    // from within a trigger.
    if ((typeof SC === "undefined") || SC.Event.triggered) return YES ;
    
    // returned undefined or NO
    var val, ret, namespace, all, handlers;

    // normalize event across browsers.  The new event will actually wrap the
    // real event with a normalized API.
    event = arguments[0] = SC.Event.normalizeEvent(event || window.event) ;

    // get the handlers for this event type
    handlers = (SC.data(this, "events") || {})[event.type];
    if (!handlers) return NO ; // nothing to do

    // invoke all handlers
    for (var key in handlers ) {
      var handler = handlers[key];
      var method = handler[1] ;

      // Pass in a reference to the handler function itself
      // So that we can later remove it
      event.handler = method;
      event.data = event.context = handler[2];

      var target = handler[0] || this ;
      ret = method.apply( target, arguments );
      if (val !== NO) val = ret;

      // if method returned NO, do not continue.  Stop propogation and
      // return default.  Note that we test explicitly for NO since 
      // if the handler returns no specific value, we do not want to stop.
      if ( ret === NO ) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    return val;
  },

  /**
    This method is called just before the window unloads to unhook all 
    registered events.
  */
  unload: function() {
    var key, elements = this._elements ;
    for(key in elements) this.remove(elements[key]) ;
    
    // just in case some book-keeping was screwed up.  avoid memory leaks
    for(key in elements) delete elements[key] ;
    delete this._elements ; 
  },
  
  /**
    This hash contains handlers for special or custom events.  You can add
    your own handlers for custom events here by simply naming the event and
    including a hash with the following properties:
    
     - setup: this function should setup the handler or return NO
     - teardown: this function should remove the event listener
     
  */
  special: {
    
    ready: {
      setup: function() {
        // Make sure the ready event is setup
        SC._bindReady() ;
        return;
      },

      teardown: function() { return; }

    },

    /** @private
        Implement support for mouseenter on browsers other than IE */
    mouseenter: {
      setup: function() {
        if ( SC.browser.msie ) return NO;
        SC.Event.add(this, 'mouseover', SC.Event.special.mouseover.handler);
        return YES;
      },

      teardown: function() {
        if ( jQuery.browser.msie ) return NO;
        SC.Event.remove(this, 'mouseover', SC.Event.special.mouseover.handler);
        return YES;
      },

      handler: function(event) {
        // If we actually just moused on to a sub-element, ignore it
        if ( SC.Event._withinElement(event, this) ) return YES;
        // Execute the right handlers by setting the event type to mouseenter
        event.type = "mouseenter";
        return SC.Event.handle.apply(this, arguments);
      }
    },

    /** @private
        Implement support for mouseleave on browsers other than IE */
    mouseleave: {
      setup: function() {
        if ( SC.browser.msie ) return NO;
        SC.Event.add(this, "mouseout", SC.Event.special.mouseleave.handler);
        return YES;
      },

      teardown: function() {
        if ( SC.browser.msie ) return NO;
        SC.Event.remove(this, "mouseout", SC.Event.special.mouseleave.handler);
        return YES;
      },

      handler: function(event) {
        // If we actually just moused on to a sub-element, ignore it
        if ( SC.Event._withinElement(event, this) ) return YES;
        // Execute the right handlers by setting the event type to mouseleave
        event.type = "mouseleave";
        return SC.Event.handle.apply(this, arguments);
      }
    }
  },

  KEY_BACKSPACE: 8,
  KEY_TAB:       9,
  KEY_RETURN:   13,
  KEY_ESC:      27,
  KEY_LEFT:     37,
  KEY_UP:       38,
  KEY_RIGHT:    39,
  KEY_DOWN:     40,
  KEY_DELETE:   46,
  KEY_HOME:     36,
  KEY_END:      35,
  KEY_PAGEUP:   33,
  KEY_PAGEDOWN: 34,
  KEY_INSERT:   45,
    
  _withinElement: function(event, elem) {
    // Check if mouse(over|out) are still within the same parent element
    var parent = event.relatedTarget;
    
    // Traverse up the tree
    while ( parent && parent != elem ) {
      try { parent = parent.parentNode; } catch(error) { parent = elem; }
    }

    // Return YES if we actually just moused on to a sub-element
    return parent === elem;
  },
  
  /** @private
    Adds the primary event listener for the named type on the element.
    
    If the event type has a special handler defined in SC.Event.special, 
    then that handler will be used.  Otherwise the normal browser method will
    be used.
    
    @param elem {Element} the target element
    @param eventType {String} the event type
  */
  _addEventListener: function(elem, eventType) {
    var listener, special = this.special[eventType] ;

    // Check for a special event handler
    // Only use addEventListener/attachEvent if the special
    // events handler returns NO
    if ( !special || special.setup.call(elem)===NO) {
      
      // Save element in cache.  This must be removed later to avoid 
      // memory leaks.
      var guid = SC.guidFor(elem) ;
      this._elements[guid] = elem;
      
      var listener = SC.data(elem, "listener") || SC.data(elem, "listener", 
       function() {
         return SC.Event.handle.apply(SC.Event._elements[guid], arguments); 
      }) ;
      
      // Bind the global event handler to the element
      if (elem.addEventListener) {
        elem.addEventListener(eventType, listener, NO);
      } else if (elem.attachEvent) {
        elem.attachEvent("on" + eventType, listener);
      }
    }
    
    elem = special = listener = null ; // avoid memory leak
  },

  /** @private
    Removes the primary event listener for the named type on the element.
    
    If the event type has a special handler defined in SC.Event.special, 
    then that handler will be used.  Otherwise the normal browser method will
    be used.
    
    Note that this will not clear the _elements hash from the element.  You
    must call SC.Event.unload() on unload to make sure that is cleared.
    
    @param elem {Element} the target element
    @param eventType {String} the event type
  */
  _removeEventListener: function(elem, eventType) {
    var listener, special = SC.Event.special[eventType] ;
    if (!special || (special.teardown.call(elem)===NO)) {
      listener = SC.data(elem, "listener") ;
      if (listener) if (elem.removeEventListener) {
        elem.removeEventListener(eventType, listener, NO);
      } else if (elem.detachEvent) {
        elem.detachEvent("on" + eventType, listener);
      }
    }
    
    elem = special = listener = null ;
  },

  _elements: {},
  
  // implement preventDefault() in a cross platform way
  
  /** @private Take an incoming event and convert it to a normalized event. */
  normalizeEvent: function(event) {
    return (event.normalized) ? event : SC.Event.create(event) ;
  },
  
  _global: {},

  /** @private properties to copy from native event onto the event */
  _props: "altKey attrChange attrName bubbles button cancelable charCode clientX clientY ctrlKey currentTarget data detail eventPhase fromElement handler keyCode metaKey newValue originalTarget pageX pageY prevValue relatedNode relatedTarget screenX screenY shiftKey srcElement target timeStamp toElement type view wheelDelta which".split(" ")
  
}) ;

SC.Event.prototype = {

  /**
    Set to YES if you have called either preventDefault() or stopPropogation().  This allows a generic event handler to notice if you want to provide detailed control over how the browser handles the real event.
  */
  hasCustomEventHandling: NO,
  
  /** 
    Implements W3C standard.  Will prevent the browser from performing its
    default action on this event.
    
    @returns {SC.Event} receiver
  */
  preventDefault: function() {
    var evt = this.originalEvent ;
    if (evt) {
      if (evt.preventDefault) evt.preventDefault() ;
      evt.returnValue = NO ; // IE
    }
    this.hasCustomEventHandling = YES ;
    return this ;
  },

  /**
    Implements W3C standard.  Prevents further bubbling of the event.
    
    @returns {SC.Event} receiver
  */
  stopPropagation: function() {
    var evt = this.originalEvent ;
    if (evt) {
      if (evt.stopPropogation) evt.stopPropagation() ;
      evt.cancelBubble = YES ; // IE
    }
    this.hasCustomEventHandling = YES ; 
    return this ;
  },

  /** 
    Stops both the default action and further propogation.  This is more 
    convenient than calling both.
    
    @returns {SC.Event} receiver
  */
  stop: function() {
    return this.preventDefault().stopPropogation();
  },
  
  /** Always YES to indicate the event was normalized. */
  normalized: YES,

  /** Returns the pressed character (found in this.which) as a string. */
  getCharString: function() { 
    return String.fromCharCode(this.which) ;
  }
    
} ;

// Also provide a Prototype-like API so that people can use either one.

/** Alias for add() method.  This provides a Prototype-like API. */
SC.Event.observe = SC.Event.add ;

/** Alias for remove() method.  This provides a Prototype-like API */
SC.Event.stopObserving = SC.Event.remove ;

/** Alias for trigger() method.  This provides a Prototype-like API */
SC.Event.fire = SC.Event.trigger;

// Register unload handler to eliminate any registered handlers
// This avoids leaks in IE and issues with mouseout or other handlers on 
// other browsers.
SC.Event.add(window, 'unload', SC.Event, SC.Event.unload) ;