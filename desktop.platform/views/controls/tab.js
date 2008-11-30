// ========================================================================
// SproutCore
// copyright 2006-2008 Sprout Systems, Inc.
// ========================================================================

require('views/view') ;
require('views/controls/container');
require('desktop.platform/views/controls/segmented');

SC.TOP_LOCATION = 'top';
SC.BOTTOM_LOCATION = 'bottom';

/** 
  @class

  Incorporates a segmented view and a container view to display the selected
  tab.  Provide an array of items, which will be passed onto the segmented
  view.
  
  @extends SC.View
  @since SproutCore 1.0
*/
SC.TabView = SC.View.extend(
/** @scope SC.ContainerView.prototype */ {

  styleClass: ['sc-tab-view'],

  // ..........................................................
  // PROPERTIES
  // 
  
  nowShowing: null,
  
  items: [],
  
  isEnabled: YES,
  
  itemTitleKey: null,
  itemValueKey: null,
  itemIsEnabledKey: null,
  itemIconKey: null,
  itemWidthKey: null,
  
  tabLocation: SC.TOP_LOCATION,
  
  // ..........................................................
  // FORWARDING PROPERTIES
  // 
  
  // forward important changes on to child views
  _tab_nowShowingDidChange: function() {
    var v = this.get('nowShowing');
    this.get('containerView').set('nowShowing',v);
    this.get('segmentedView').set('value',v);
    return this ;
  }.observes('nowShowing'),

  _tab_itemsDidChange: function() {
    this.get('segmentedView').set('items', this.get('items'));
    return this ;    
  }.observes('items'),

  prepareDisplay: function() {
    sc_super();
    this._tab_nowShowingDidChange()._tab_itemsDidChange();
  },
  
  createChildViews: function() {
    var childViews = [], view; 
    view = this.containerView = this.createChildView(this.containerView) ;
    childViews.push(view);
    
    view = this.segmentedView = this.createChildView(this.segmentedView) ;
    childViews.push(view);

    this.set('childViews', childViews);
    return this; 
  },
  
  // ..........................................................
  // COMPONENT VIEWS
  // 

  /**
    The containerView managed by this tab view.  Note that TabView uses a 
    custom container view.  You can access this view but you cannot change 
    it.
  */
  containerView: SC.ContainerView.extend({
    
    /** @private
      When we need to actually create a container, look for the tab loc from
      the parent view and adjust the internal frame accordingly.
    */
    prepareDisplay: function() {
      var ret = sc_super();
      
      var pv = this.get('parentView');
      var tabLoc = (pv) ? pv.get('tabLocation') : SC.TOP_LOCATION ;
      if (tabLoc === SC.TOP_LOCATION) {
        this.adjust('top', 11);
      } else {
        this.adjust('bottom',11);
      }
      
      return ret ;
    }
  }),
  
  /**
    The segmentedView managed by this tab view.  Note that this TabView uses
    a custom segmented view.  You can access this view but you cannot change
    it.
  */
  segmentedView: SC.SegmentedView.extend({
    layout: { left: 0, right: 0, height: 23 },

    /** @private
      When the value changes, update the parentView's value as well.
    */
    valueDidChange: function() {
      var pv = this.get('parentView');
      if (pv) pv.set('nowShowing', this.get('value'));
    }.observes('value'),
    
    /** @private
      When we need to actually create a container, look for the tab loc from
      the parent view and adjust the internal frame accordingly.  Also copy
      the item key settings from the tab view.
    */
    prepareDisplay: function() {
      // copy some useful properties from the parent view first
      var pv = this.get('parentView');
      var tabLoc = (pv) ? pv.get('tabLocation') : SC.TOP_LOCATION ;
      if (tabLoc === SC.TOP_LOCATION) {
        this.adjust('top', 0);
      } else {
        this.adjust('bottom',0);
      }
      
      if (pv) {
        this.beginPropertyChanges();
        SC._TAB_ITEM_KEYS.forEach(function(k) { 
          this.set(k, pv.get(k)); 
        }, this);
        this.endPropertyChanges();
      }

      return sc_super();
    }
  })
  
}) ;

SC._TAB_ITEM_KEYS = 'itemTitleKey itemValueKey itemIsEnabledKey itemIconKey itemWidthKey'.w();