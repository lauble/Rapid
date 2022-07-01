import { dispatch as d3_dispatch } from 'd3-dispatch';
import { vecEqual } from '@id-sdk/math';

import { AbstractBehavior } from './AbstractBehavior';
import { utilRebind } from '../util';

const DEBUG = false;


/**
 * `BehaviorHover` listens to pointer events and hovers items that are hovered over
 *
 * Properties available:
 *   `enabled`      `true` if the event handlers are enabled, `false` if not.
 *   `lastMove`     `eventData` Object for the most recent move event
 *   `hoverTarget`   Current hover target (a PIXI DisplayObject), or null
 *
 * Events available:
 *   `hoverchanged`  Fires whenever the hover target has changed, receives `eventData` Object
 */
export class BehaviorHover extends AbstractBehavior {

  /**
   * @constructor
   * @param  `context`  Global shared application context
   */
  constructor(context) {
    super(context);
    this.id = 'hover';

    this._dispatch = d3_dispatch('hoverchanged');
    utilRebind(this, this._dispatch, 'on');

    this.lastMove = null;
    this.hoverTarget = null;

    // Make sure the event handlers have `this` bound correctly
    this._pointermove = this._pointermove.bind(this);
  }


  /**
   * enable
   * Bind event handlers
   */
  enable() {
    if (this._enabled) return;
    if (!this.context.pixi) return;

    if (DEBUG) {
      console.log('BehaviorHover: enabling listeners');  // eslint-disable-line no-console
    }

    this._enabled = true;
    this.lastMove = null;
    this.hoverTarget = null;

    const interactionManager = this.context.pixi.renderer.plugins.interaction;
    interactionManager
      .on('pointermove', this._pointermove)
      .on('pointerout', this._pointermove);   // or leaves the canvas
  }


  /**
   * disable
   * Unbind event handlers
   */
  disable() {
    if (!this._enabled) return;
    if (!this.context.pixi) return;

    if (DEBUG) {
      console.log('BehaviorHover: disabling listeners');  // eslint-disable-line no-console
    }

    this._enabled = false;
    this.lastMove = null;
    this.hoverTarget = null;

    const interactionManager = this.context.pixi.renderer.plugins.interaction;
    interactionManager
      .off('pointermove', this._pointermove)
      .off('pointerout', this._pointermove);
  }


  /**
   * _pointermove
   * Handler for pointermove, pointerout events.
   * @param  `e`  A Pixi InteractionEvent
   */
  _pointermove(e) {
    const move = this._getEventData(e);

    // We get a lot more move events than we need,
    // so discard ones where it hasn't actually moved much
    if (this.lastMove && vecEqual(move.coord, this.lastMove.coord, 0.9)) return;
    this.lastMove = move;

    // If pointer is not over the renderer, consider it a null target..
    // (e.g. sidebar, out of browser window, over a button, toolbar, modal)
    const interactionManager = this.context.pixi.renderer.plugins.interaction;
    const pointerOverRenderer = interactionManager.mouseOverRenderer;
    if (!pointerOverRenderer) {
      move.target = null;
      move.data = null;
    }

    // Hover target has changed
    if (this.hoverTarget !== move.target) {
      this.hoverTarget = move.target;

      if (DEBUG) {
        const name = (move.target && move.target.name) || 'no target';
        console.log(`BehaviorHover: dispatching 'hoverchanged', hoverTarget = ${name}`);  // eslint-disable-line no-console
      }
      this._dispatch.call('hoverchanged', this, move);


// vvv---- everything below here should be listening instead
      let ids = [];
      if (move.target && move.data) {
        ids = [move.target.name];  // the featureID is here (e.g. osm id)
      }

      this.context.map().renderer().hover(ids);
      // this.context.ui().sidebar.hover([move.data]);
    }
  }

}
