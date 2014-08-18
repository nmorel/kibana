/** @scratch /panels/5
 *
 * include::panels/terms.asciidoc[]
 */

/** @scratch /panels/aggstats/0
 *
 * == aggstats
 * Status: *Experimental*
 *
 * A table chart based on the results of an Elasticsearch stat aggregation.
 *
 */
define([
  'angular',
  'app',
  'lodash',
  'jquery',
  'kbn'
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('kibana.panels.aggstats', []);
  app.useModule(module);

  module.controller('aggstats', function($scope, querySrv, dashboard, filterSrv, fields) {
    $scope.panelMeta = {
      modals : [
        {
          description: "Inspect",
          icon: "icon-info-sign",
          partial: "app/partials/inspector.html",
          show: $scope.panel.spyable
        }
      ],
      editorTabs : [
        {title:'Queries', src:'app/partials/querySelect.html'}
      ],
      status  : "Experimental",
      description : "Displays the results of an Elasticsearch stat aggregation as a table"
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/aggstats/5
       * === Parameters
       *
       * field:: The field on which to computer the aggregation
       */
      field   : 'service',
      /** @scratch /panels/aggstats/5
       * size:: Show this many terms
       */
      size    : 0,
      /** @scratch /panels/aggstats/5
       * order:: stats.count, stats.sum, stats.min, stats.max, stats.avg
       */
      order   : 'stats.sum',
      /** @scratch /panels/aggstats/5
       * percentile:: Set percentile to false to disable the percentiles
       */
      percentile     : true,
      style   : { "font-size": '10pt'},
      /** @scratch /panels/aggstats/5
       * counter_pos:: The location of the legend in respect to the chart, above, below, or none.
       */
      counter_pos : 'above',
      /** @scratch /panels/aggstats/5
       * spyable:: Set spyable to false to disable the inspect button
       */
      spyable     : true,
      /** @scratch /panels/aggstats/5
       *
       * ==== Queries
       * queries object:: This object describes the queries to use on this panel.
       * queries.mode::: Of the queries available, which to use. Options: +all, pinned, unpinned, selected+
       * queries.ids::: In +selected+ mode, which query ids are selected.
       */
      queries     : {
        mode        : 'all',
        ids         : []
      },
      /** @scratch /panels/aggstats/5
       * valuefield:: value field
       */
      valuefield  : 'duration'
    };

    _.defaults($scope.panel,_d);

    $scope.init = function () {
      $scope.hits = 0;

      $scope.$on('refresh',function(){
        $scope.get_data();
      });
      $scope.get_data();

    };

    $scope.get_data = function() {
      // Make sure we have everything for the request to complete
      if(dashboard.indices.length === 0) {
        return;
      }

      $scope.panelMeta.loading = true;
      var request,
        results,
        boolQuery,
        queries;

      $scope.field = _.contains(fields.list,$scope.panel.field+'.raw') ? $scope.panel.field+'.raw' : $scope.panel.field;

      request = $scope.ejs.Request().indices(dashboard.indices);
      $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
      queries = querySrv.getQueryObjs($scope.panel.queries.ids);

      // This could probably be changed to a BoolFilter
      boolQuery = $scope.ejs.BoolQuery();
      _.each(queries,function(q) {
        boolQuery = boolQuery.should(querySrv.toEjsObj(q));
      });

      request = request.query(
        $scope.ejs.FilteredQuery(
          boolQuery,
          filterSrv.getBoolFilter(filterSrv.ids())
        ))
        .size(0);

      // Adding aggregation
      var order = {};
      order[$scope.panel.order] = "desc";
      var aggs = {
        "services": {
          "terms": {
            "field": $scope.field,
            "size": $scope.panel.size,
            "order": order
          },
          "aggs": {
            "stats": {
              "stats": {
                "field": $scope.panel.valuefield
              }
            }
          }
        }
      };
      if($scope.panel.percentile) {
        aggs.services.aggs.percentiles = {
          "percentiles": {
            "field": $scope.panel.valuefield
          }
        };
      }
      request._self().aggs = aggs;

      // Populate the inspector panel
      $scope.inspector = angular.toJson(JSON.parse(request.toString()),true);

      results = request.doSearch();

      // Populate scope when we have results
      results.then(function(results) {
        $scope.panelMeta.loading = false;
        $scope.results = results;
        $scope.data = results.aggregations.services.buckets;
        $scope.$emit('render');
      });
    };

    $scope.build_search = function(term,negate) {
      filterSrv.set({type:'terms', field:$scope.field, value:term, mandate:(negate ? 'mustNot':'must')});
    };

    $scope.set_refresh = function (state) {
      $scope.refresh = state;
    };

    $scope.close_edit = function() {
      if($scope.refresh) {
        $scope.get_data();
      }
      $scope.refresh =  false;
      $scope.$emit('render');
    };

  });

});
