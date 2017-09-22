///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import coreModule from '../../core_module';

export class SearchCtrl {
  isOpen: boolean;
  query: any;
  giveSearchFocus: number;
  selectedIndex: number;
  results: any;
  currentSearchId: number;
  tagsMode: boolean;
  showImport: boolean;
  dismiss: any;
  ignoreClose: any;
  // triggers fade animation class
  openCompleted: boolean;

  /** @ngInject */
  constructor($scope, private $location, private $timeout, private backendSrv, public contextSrv, $rootScope) {
    $rootScope.onAppEvent('show-dash-search', this.openSearch.bind(this), $scope);
    $rootScope.onAppEvent('hide-dash-search', this.closeSearch.bind(this), $scope);
  }

  closeSearch() {
    this.isOpen = this.ignoreClose;
    this.openCompleted = false;
    this.contextSrv.isSearching = this.isOpen;
  }

  openSearch(evt, payload) {
    if (this.isOpen) {
      this.closeSearch();
      return;
    }

    this.isOpen = true;
    this.contextSrv.isSearching = true;
    this.giveSearchFocus = 0;
    this.selectedIndex = -1;
    this.results = [];
    this.query = { query: '', tag: [], starred: false, mode: 'tree' };
    this.currentSearchId = 0;
    this.ignoreClose = true;

    if (payload && payload.starred) {
      this.query.starred = true;
    }

    if (payload && payload.tagsMode) {
      return this.$timeout(() => {
        this.ignoreClose = false;
        this.giveSearchFocus = this.giveSearchFocus + 1;
        this.getTags();
      }, 100);
    }

    this.$timeout(() => {
      this.openCompleted = true;
      this.ignoreClose = false;
      this.giveSearchFocus = this.giveSearchFocus + 1;
      this.search();
    }, 100);
  }

  keyDown(evt) {
    if (evt.keyCode === 27) {
      this.closeSearch();
    }
    if (evt.keyCode === 40) {
      this.moveSelection(1);
    }
    if (evt.keyCode === 38) {
      this.moveSelection(-1);
    }
    if (evt.keyCode === 13) {
      if (this.tagsMode) {
        var tag = this.results[this.selectedIndex];
        if (tag) {
          this.filterByTag(tag.term, null);
        }
        return;
      }

      var selectedDash = this.results[this.selectedIndex];
      if (selectedDash) {
        this.$location.search({});
        this.$location.path(selectedDash.url);
      }
    }
  }

  moveSelection(direction) {
    var max = (this.results || []).length;
    var newIndex = this.selectedIndex + direction;
    this.selectedIndex = ((newIndex %= max) < 0) ? newIndex + max : newIndex;
  }

  searchDashboards() {
    this.tagsMode = false;
    this.currentSearchId = this.currentSearchId + 1;
    var localSearchId = this.currentSearchId;

    return this.backendSrv.search(this.query).then(results => {
      if (localSearchId < this.currentSearchId) { return; }

      let byId = _.groupBy(results, 'id');
      let byFolderId = _.groupBy(results, 'folderId');
      let finalList = [];

      // add missing parent folders
      _.each(results, (hit, index) => {
        if (hit.folderId && !byId[hit.folderId]) {
          const folder = {
            id: hit.folderId,
            uri: `db/${hit.folderSlug}`,
            title: hit.folderTitle,
            type: 'dash-folder'
          };
          byId[hit.folderId] = folder;
          results.splice(index, 0, folder);
        }
      });

      // group by folder
      for (let hit of results) {
        if (hit.folderId) {
          hit.type = "dash-child";
        } else {
          finalList.push(hit);
        }

        hit.url = 'dashboard/' + hit.uri;

        if (hit.type === 'dash-folder') {
          if (!byFolderId[hit.id]) {
            continue;
          }

          for (let child of byFolderId[hit.id]) {
            finalList.push(child);
          }
        }
      }

      this.results = finalList;
    });
  }

  queryHasNoFilters() {
    var query = this.query;
    return query.query === '' && query.starred === false && query.tag.length === 0;
  }

  filterByTag(tag, evt) {
    this.query.tag.push(tag);
    this.search();
    this.giveSearchFocus = this.giveSearchFocus + 1;
    if (evt) {
      evt.stopPropagation();
      evt.preventDefault();
    }
  }

  removeTag(tag, evt) {
    this.query.tag = _.without(this.query.tag, tag);
    this.search();
    this.giveSearchFocus = this.giveSearchFocus + 1;
    evt.stopPropagation();
    evt.preventDefault();
  }

  getTags() {
    return this.backendSrv.get('/api/dashboards/tags').then((results) => {
      this.tagsMode = !this.tagsMode;
      this.results = results;
      this.giveSearchFocus = this.giveSearchFocus + 1;
      if ( !this.tagsMode ) {
        this.search();
      }
    });
  }

  showStarred() {
    this.query.starred = !this.query.starred;
    this.giveSearchFocus = this.giveSearchFocus + 1;
    this.search();
  }

  search() {
    this.showImport = false;
    this.selectedIndex = 0;
    this.searchDashboards();
  }

}

export function searchDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/core/components/search/search.html',
    controller: SearchCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {},
  };
}

coreModule.directive('dashboardSearch', searchDirective);
