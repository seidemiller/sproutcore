// ========================================================================
// SproutCore
// copyright 2006-2008 Sprout Systems, Inc.
// ========================================================================

require('system/object');

// ........................................................................
// CHAIN OBSERVER
//

// This is a private class used by the observable mixin to support chained
// properties.

// ChainObservers are used to automatically monitor a property several 
// layers deep.
// org.plan.name = SC._ChainObserver.create({
//    target: this, property: 'org',
//    next: SC._ChainObserver.create({
//      property: 'plan',
//      next: SC._ChainObserver.create({
//        property: 'name', func: myFunc
//      })
//    })
//  })
//
SC._ChainObserver = function(property) {
  this.property = property ;
} ;

// This is the primary entry point.  Configures the chain.
SC._ChainObserver.createChain = function(rootObject, path, target, method) {

  var parts = path.split('.') ;
  
  // First we create the chain.
  var root ;
  var tail = root = new SC._ChainObserver(parts[0]) ;
  var len = parts.length;
  for(var idx=1;idx<len;idx++) {
    tail = tail.next = new SC._ChainObserver(parts[idx]) ;
  }
  
  // Now root has the first observer and tail has the last one.
  // Feed the rootObject into the front to setup the chain...
  // do this BEFORE we set the target/method so they will not be triggered.
  root.objectDidChange(rootObject);
  
  // Finally, set the target/method on the tail so that future changes will
  // trigger.
  tail.target = target; tail.method = method ;
  
  // and return the root to save
  return root ;
};

SC._ChainObserver.prototype = {
  isChainObserver: true,
  
  // the object this instance is observing
  object: null,
  
  // the property on the object this link is observing.
  property: null,
  
  // if not null, this is the next link in the chain.  Whenever the 
  // current property changes, the next observer will be notified.
  next: null,
  
  // if not null, this is the final target observer.
  target: null,
  
  // if not null, this is the final target method
  method: null,
  
  // invoked when the source object changes.  removes observer on old 
  // object, sets up new observer, if needed.
  objectDidChange: function(newObject) {
    if (newObject === this.object) return; // nothing to do.
    
    // if an old object, remove observer on it.
    if (this.object && this.object.removeObserver) {
      this.object.removeObserver(this.property, this, this.propertyDidChange);
    }
    
    // if a new object, add observer on it...
    this.object = newObject ;
    if (this.object && this.object.addObserver) {
      this.object.addObserver(this.property, this, this.propertyDidChange); 
    }
    
    // now, notify myself that my property value has probably changed.
    this.propertyDidChange() ;
  },
  
  // the observer method invoked when the observed property changes.
  propertyDidChange: function() {
    
    // get the new value
    var object = this.object ;
    var property = this.property ;
    var value = (object && object.get) ? object.get(property) : null ;
    
    // if we have a next object in the chain, notify it that its object 
    // did change...
    if (this.next) this.next.objectDidChange(value) ;
    
    // if we have a target/method, call it.
    var target = this.target; var method = this.method;
    if (target && method) {
      var rev = object.propertyRevision ;
      method.call(target, object, property, value, rev) ;
    } 
  },
  
  // teardown the chain...
  destroyChain: function() {
    
    // remove observer
    var obj = this.object ;
    if (obj && obj.removeObserver) {
      obj.removeObserver(this.property, this, this.propertyDidChange) ;
    }  
    
    // destroy next item in chain
    if (this.next) this.next.destroyChain() ;
    
    // and clear left overs...
    this.next = this.target = this.method = this.object = null ;
    return null ;
  }
  
} ;