String.prototype.ucFirst = function() {
    return this.charAt(0).toUpperCase() + this.slice(1).toLowerCase();
}

if(typeof defaultValue != 'function'){
    window.defaultValue = function(val,defaultValue){
        return typeof val != 'undefined' ? val : defaultValue;
    }
}

pimcore.registerNS('pimcore.plugin.processmanager');

pimcore.plugin.processmanager = Class.create({
    config : {},

    getClassName: function() {
        return "pimcore.plugin.processmanager";
    },

    initialize: function() {
        document.addEventListener(pimcore.events.preMenuBuild, this.createNavigationEntry.bind(this));
    },

    createNavigationEntry: function (e) {
        let menu = e.detail.menu;
        const user = pimcore.globalmanager.get('user');
        if (menu.extras &&
            (user.isAllowed("plugin_pm_permission_view") || user.isAllowed("plugin_pm_permission_configure"))
        ) {
            menu.extras.items.push({
                text: t("plugin_pm"),
                iconCls: "plugin_pmicon",
                cls: "pimcore_main_menu",
                handler: this.showProcessManager.bind(this)
            });
        }

            //ignore process manager process log request exceptions as otherwise annoying errors can pop up in the pimcore backend
            Ext.Ajax.on({requestexception: function (conn, response, options) {
                if(response.request.url.startsWith('/admin/elementsprocessmanager/monitoring-item/list') && options.action === "read") {
                    options.ignoreErrors = true;
                }
            }, priority: 1000});

        this.getConfig();
    },

    showProcessManager : function (config){
        config = defaultValue(config,{});
        if (pimcore.globalmanager.get("plugin_pm_cnf")) {
            Ext.getCmp("pimcore_panel_tabs").setActiveItem("pimcore_plugin_pm_panel");
            if(config.activeTab){
                Ext.getCmp("pimcore_plugin_pm_panel").setActiveTab(config.activeTab);
            }
        } else {
            pimcore.globalmanager.add("plugin_pm_cnf", new pimcore.plugin.processmanager.panel.general(config));
        }
    },

    getConfig : function(){
        Ext.Ajax.request({
            url: '/admin/elementsprocessmanager/index/get-plugin-config',
            success: function(response, opts) {
                this.config = Ext.decode(response.responseText);
                this.addShortcutMenu();
                this.initActiveProcesses();

                //just for testing
                //this.showProcessManager({activeTab: 1});
            }.bind(this)
        });
    },

    initActiveProcesses : function(){
        if(pimcore.globalmanager.get("user").isAllowed("plugin_pm_permission_execute")){
            this.activeProcesses = new pimcore.plugin.processmanager.window.activeProcesses();
            this.activeProcesses.refreshTask.start();
        }
    },

    getMenuItem : function (data) {
        return {
            text: data.name,
            iconCls: "pm_icon_cli",
            handler : this.executeJob.bind(this,data.id)
        }
    },
    addShortcutMenu : function () {
        if(pimcore.globalmanager.get("user").isAllowed("plugin_pm_permission_execute")){

            if(this.config.shortCutMenu){
                var menuItems = [];
                for(var key in this.config.shortCutMenu){
                    if(key != 'default'){
                        var group = {
                            text: key,
                            iconCls: "pimcore_icon_folder",
                            hideOnClick: false,
                            menu: {
                                cls: "pimcore_navigation_flyout",
                                shadow: false,
                                items: []
                            }
                        }
                        var childs = this.config.shortCutMenu[key];
                        for(var i = 0; i < childs.length; i++ ){
                            group.menu.items.push(this.getMenuItem(childs[i]))
                        }
                        menuItems.push(group);
                    }
                }

                if(this.config.shortCutMenu['default']){
                    var childs = this.config.shortCutMenu['default'];
                    for(var i = 0; i < childs.length; i++ ){
                        menuItems.push(this.getMenuItem(childs[i]));
                    }
                }

                var menu = new Ext.menu.Menu({
                    items: menuItems,
                    shadow: false,
                    cls: "pimcore_navigation_flyout"
                });


                var insertPoint = Ext.get("pimcore_menu_settings");
                if(!insertPoint) {
                    var dom = Ext.dom.Query.select('#pimcore_navigation ul li:last');
                    insertPoint = Ext.get(dom[0]);
                }
                var toolbar = pimcore.globalmanager.get("layout_toolbar");

                this.navEl = Ext.get(
                    insertPoint.insertHtml(
                        "afterEnd",
                        '<li id="plugin_pm_shortcut_menu" class="pimcore_menu_item" data-menu-tooltip="' + t('plugin_pm')+'">'  +
                        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" enable-background="new 0 0 48 48">' +
                        '<path fill="#37474F" d="M34.9,29.1c-2.7-2.7-7.1-2.7-9.8,0l-4,4c-1.7,1.7-4.5,1.7-6.2,0c-1.7-1.7-1.7-4.5,0-6.2l4.5-4.5l-2.8-2.8 l-4.5,4.5c-3.3,3.3-3.3,8.6,0,11.8c3.3,3.3,8.6,3.3,11.8,0l4-4c1.2-1.1,3-1.1,4.2,0c1.1,1.2,1.1,3,0,4.2L27,41.2l2.8,2.8l5.1-5.1 C37.6,36.2,37.6,31.8,34.9,29.1z"/>' +
                        '<path fill="#0277BD" d="M16.1,22.9L16.1,22.9c-2.8-2.8-2.8-7.3,0-10l6.8-6.8c2.8-2.8,7.3-2.8,10,0l0,0c2.8,2.8,2.8,7.3,0,10 l-6.8,6.8C23.3,25.7,18.9,25.7,16.1,22.9z"/>' +
                        '<circle fill="#B3E5FC" cx="28" cy="11" r="4"/>' +
                        '</svg>' +
                        '</li>'
                    )
                );

                this.navEl.on("mousedown", toolbar.showSubMenu.bind(menu));
                pimcore.helpers.initMenuTooltips();
            }
        }
    },

    monitoringItemRestart : function(id){
        Ext.Ajax.request({
            url: '/admin/elementsprocessmanager/monitoring-item/restart?id=' + id,
            success: function(response, opts) {
                var data = Ext.decode(response.responseText);
                if(data.success){
                    pimcore.helpers.showNotification(t("success"), t("plugin_pm_restart_success"), "success");
                    this.activeProcesses.refreshTask.start();
                    Ext.getCmp("plugin_pmmonitoring_item_list_panel").store.reload();
                }else{
                    pimcore.helpers.showNotification(t("error"), t("plugin_pm_restart_error"), "error",data.message);
                }
            }.bind(this)
        });
    },


    monitoringReopenCallback : function(configurationId,monitoringItemId){
        Ext.Ajax.request({
            url: '/admin/elementsprocessmanager/monitoring-item/get-by-id?id=' + monitoringItemId,
            success: function(response, opts) {
                processmanagerPlugin.executeJob(configurationId,Ext.decode(response.responseText));
            }.bind(this)
        });
    },

    monitoringItemCancel : function (id) {
        Ext.Ajax.request({
            url: '/admin/elementsprocessmanager/monitoring-item/cancel?id=' + id,
            success: function(response, opts) {
                var data = Ext.decode(response.responseText);
                if(data.success){
                    pimcore.helpers.showNotification(t("success"), t("plugin_pm_cancel_success"), "success");
                    Ext.getCmp("plugin_pmmonitoring_item_list_panel").store.reload();
                }else{
                    pimcore.helpers.showNotification(t("error"), t("plugin_pm_cancel_error"), "error",data.message);
                }
            }.bind(this)
        });
    },

    openLogId : function (id){
        processmanagerPlugin.showProcessManager({activeTab: 1});

        let pm = pimcore.globalmanager.get("plugin_pm_cnf");

        let column = pm.monitoringItems.grid.columnManager.getColumns()[0];
        column.filter.setValue({eq : id});
        column.filter.setActive(true);
        pm.monitoringItems.grid.store.reload();
    },

    download : function(id,accessKey){
        var url = '/admin/elementsprocessmanager/index/download?id='+ id +'&accessKey=' + accessKey;
        pimcore.helpers.download(url);
    },

    executeJob: function (id,monitoringItemData) {
        Ext.Ajax.request({
            url: '/admin/elementsprocessmanager/config/get-by-id?id=' + id,
            success: function (response) {
                var data = Ext.decode(response.responseText);
                if (data.success) {
                    var configData = data.data;
                    var callbackClass = configData.executorSettings.values.callback;
                    if (callbackClass) {
                        callbackClass = eval('new ' + callbackClass + '()');
                    } else {
                        callbackClass = new pimcore.plugin.processmanager.executor.callback.default();
                    }

                    if(monitoringItemData){
                        configData.monitoringItemData = monitoringItemData;
                    }

                    callbackClass.reset();
                    callbackClass.setConfig(configData);
                    callbackClass.execute();
                } else {
                    pimcore.helpers.showNotification(t("error"), t("plugin_pm_error_process_manager"), "error", data.message);
                }
            }.bind(this)
        });
    }
});

const processmanagerPlugin = new pimcore.plugin.processmanager();

/**
 * Handle events triggered by action columns is Process Log panel
 */
document.addEventListener('processManager.monitoringItemGrid', (e) => {
    e.preventDefault();
    let currentTarget = e.detail.sourceEvent.currentTarget;

    //print out the parameters of the event
    if(e.detail.trigger === 'monitoringItemRestart'){
        processmanagerPlugin.monitoringItemRestart(e.detail.monitoringId);
    }else if(e.detail.trigger === 'showLogs'){
        let tmpObject = new pimcore.plugin.processmanager.executor.logger.file();
        let actionIndex = e.detail.sourceEvent.currentTarget.getAttribute('data-process-manager-action-index');
        tmpObject.showLogs(e.detail.monitoringId,actionIndex);
    }
});