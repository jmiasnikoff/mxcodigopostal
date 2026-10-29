<?php

if (!defined('_PS_VERSION_')) {
    exit;
}

class Mxcodigopostal extends Module
{
    protected $_hooks = array(
        'displayHeader',
    );

    public function __construct()
    {
        $this->name = 'mxcodigopostal';
        $this->tab = 'front_office_features';
        $this->version = '1.1.0';
        $this->ps_versions_compliancy = array('min' => '9.2.0', 'max' => _PS_VERSION_);
        $this->author = 'Jesús Franco Miasnikoff';
        $this->need_instance = 0;

        $this->bootstrap = true;

        parent::__construct();

        $this->displayName = $this->trans('Código Postal México', array(), 'Modules.Mxcodigopostal.Admin');
        $this->description = $this->trans('Autocompleta estado, ciudad y colonia en el checkout a partir del código postal, usando el catálogo de códigos postales del módulo carriercdmx.', array(), 'Modules.Mxcodigopostal.Admin');
        $this->confirmUninstall = $this->trans('¿Seguro que deseas eliminar el módulo?', array(), 'Modules.Mxcodigopostal.Admin');
    }

    public function install()
    {
        if (!parent::install()) {
            return false;
        }

        foreach ($this->_hooks as $hook) {
            if (!$this->registerHook($hook)) {
                return false;
            }
        }

        return true;
    }

    public function uninstall()
    {
        foreach ($this->_hooks as $hook) {
            $this->unregisterHook($hook);
        }

        return parent::uninstall();
    }

    public function hookDisplayHeader($params)
    {
        $this->context->controller->registerJavascript(
            'mxcodigopostal-front',
            'modules/'.$this->name.'/views/js/mxcodigopostal.js',
            array('position' => 'bottom', 'priority' => 150)
        );

        $this->context->controller->registerStylesheet(
            'mxcodigopostal-front',
            'modules/'.$this->name.'/views/css/mxcodigopostal.css',
            array('position' => 'head', 'priority' => 150)
        );

        Media::addJsDef(array(
            'mxcodigopostalAjaxUrl' => $this->context->link->getModuleLink($this->name, 'ajax', array(), true),
        ));
    }
}
