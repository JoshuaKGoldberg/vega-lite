/* tslint:disable:quotemark */

import {assert} from 'chai';
import {normalize} from '../src/spec';

describe("normalizeErrorBar", () => {

    it("should produce correct layered specs for horizontal error bar", () => {
      assert.deepEqual(normalize({
        "data": {"url": "data/population.json"},
        mark: "error-bar",
        encoding: {
          "y": {"field": "age","type": "ordinal"},
          "x": {
            "aggregate": "min",
            "field": "people",
            "type": "quantitative",
            "axis": {"title": "population"}
          },
          "x2": {
            "aggregate": "max",
            "field": "people",
            "type": "quantitative"
          },
          "size": {"value": 5}
        }
      }), {
        "data": {"url": "data/population.json"},
        "layer": [
          {
            "mark": "rule",
            "encoding": {
              "y": {"field": "age","type": "ordinal"},
              "x": {
                "aggregate": "min",
                "field": "people",
                "type": "quantitative",
                "axis": {"title": "population"}
              },
              "x2": {
                "aggregate": "max",
                "field": "people",
                "type": "quantitative"
              }
            }
          },
          {
            "mark": "tick",
            "encoding": {
              "y": {"field": "age","type": "ordinal"},
              "x": {
                "aggregate": "min",
                "field": "people",
                "type": "quantitative",
                "axis": {"title": "population"}
              },
              "size": {"value": 5}
            }
          },
          {
            "mark": "tick",
            "encoding": {
              "y": {"field": "age","type": "ordinal"},
              "x": {
                "aggregate": "max",
                "field": "people",
                "type": "quantitative",
                // "axis": {"title": "population"}
              },
              "size": {"value": 5}
            }
          }
        ]
      });
    });

   it("should throw error when missing x2 and y2", () => {
      assert.throws(() => {
        normalize({
          "data": {"url": "data/population.json"},
          mark: "error-bar",
          encoding: {
            "y": {"field": "age","type": "ordinal"},
            "x": {
              "aggregate": "min",
              "field": "people",
              "type": "quantitative",
              "axis": {"title": "population"}
            },
            "size": {"value": 5}
          }
        });
      }, Error, 'Neither x2 or y2 provided');
    });
 });


describe("normalizeBox", () => {
  it("should throw error when missing x2 and y2", () => {
      assert.throws(() => {
        normalize({
          "description": "A error bar plot showing mean, min, and max in the US population distribution of age groups in 2000.",
          "data": {"url": "data/population.json"},
          "transform": {"filter": "datum.year == 2000"},
          mark: "box",
          encoding: {
            "y": {"field": "age","type": "ordinal"},
            "x": {
              "aggregate": "min",
              "field": "people",
              "type": "quantitative",
              "axis": {"title": "population"}
            },
            "size": {"value": 5}
          }
        });
      }, Error, 'Neither x2 or y2 provided');
  });

  it("should produce correct layered specs for boxplot with min and max lower and upper ticks", () => {
     assert.deepEqual(normalize({
        "description": "A box plot showing median, min, and max in the US population distribution of age groups in 2000.",
        "data": {"url": "data/population.json"},
        mark: "box",
        encoding: {
          "x": {"field": "age","type": "ordinal"},
          "y": {
            "aggregate": "min",
            "field": "people",
            "type": "quantitative",
            "axis": {"title": "population"}
          },
          "y2": {
            "aggregate": "max",
            "field": "people",
            "type": "quantitative"
          },
          "size": {"value": 5},
          "color": {"value" : "white"}
        }
      }), {
        "description": "A box plot showing median, min, and max in the US population distribution of age groups in 2000.",
        "data": {"url": "data/population.json"},
        "layer": [
          {
            "mark": "rule",
            "encoding": {
              "x": {"field": "age","type": "ordinal"},
              "y": {
                "aggregate": "min",
                "field": "people",
                "type": "quantitative",
                "axis": {"title": "population"}
              },
              "y2": {
                "aggregate": "max",
                "field": "people",
                "type": "quantitative"
              }
            }
          },
          {
            "mark": "tick",
            "encoding": {
              "x": {"field": "age","type": "ordinal"},
              "y": {
                "aggregate": "min",
                "field": "people",
                "type": "quantitative",
                "axis": {"title": "population"}
              },
              "size": {"value": 5}
            }
          },
          {
            "mark": "tick",
            "encoding": {
              "x": {"field": "age","type": "ordinal"},
              "y": {
                "aggregate": "max",
                "field": "people",
                "type": "quantitative"
              },
              "size": {"value": 5}
            }
          },
          {
            "mark": "bar",
            "encoding": {
              "x": {"field": "age","type": "ordinal"},
              "y": {
                "aggregate": "q1",
                "field": "people",
                "type": "quantitative"
              },
              "y2": {
                "aggregate": "q3",
                "field": "people",
                "type": "quantitative"
              },
              "size": {"value": 5}
            }
          },
          {
            "mark": "tick",
            "encoding": {
              "x": {"field": "age","type": "ordinal"},
              "y": {
                "aggregate": "median",
                "field": "people",
                "type": "quantitative"
              },
              "size": {"value": 5},
              "color": {"value" : "white"}
            }
          }
        ]
      });
  });


});
