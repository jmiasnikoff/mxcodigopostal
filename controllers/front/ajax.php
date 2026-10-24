<?php

if (!defined('_PS_VERSION_')) {
    exit;
}

class MxcodigopostalAjaxModuleFrontController extends ModuleFrontController
{
    public $ssl = true;
    public $auth = false;

    public function initContent()
    {
        header('Content-Type: application/json; charset=utf-8');

        $postcode = Tools::getValue('cp');

        if (!preg_match('/^\d{5}$/', (string) $postcode)) {
            $this->ajaxDie(json_encode(array('success' => false, 'message' => 'CP inválido')));
        }

        $table = _DB_PREFIX_.'carriercdmx_zipcodes';

        if (!$this->tableExists($table)) {
            $this->ajaxDie(json_encode(array('success' => false, 'message' => 'Catálogo no disponible')));
        }

        $rows = Db::getInstance(_PS_USE_SQL_SLAVE_)->executeS('
            SELECT DISTINCT colonia, city, estado_iso
            FROM `'.pSQL($table).'`
            WHERE zipcode = '.(int) $postcode.'
            AND colonia IS NOT NULL
            ORDER BY colonia ASC
        ');

        if (!$rows) {
            $this->ajaxDie(json_encode(array('success' => false, 'message' => 'CP no encontrado')));
        }

        $city = $rows[0]['city'];
        $estadoIso = $rows[0]['estado_iso'];
        $idCountryMx = (int) Country::getByIso('MX');
        $idState = 0;

        // No se usa State::getIdByIso() ni Db::getValue(): en esta instalación devuelven
        // resultados obsoletos/cacheados para esta consulta. executeS() sí es confiable.
        // El estado_iso 'DIF' (import original de CDMX) no coincide con el iso_code real
        // en ps_state, que aquí es 'CMX'; se cubren esas variantes conocidas.
        if ($estadoIso) {
            $isoCandidates = $estadoIso === 'DIF'
                ? array('CMX', 'DIF', 'CDMX', 'DF')
                : array($estadoIso);

            $placeholders = implode(',', array_map(function ($iso) {
                return '\''.pSQL($iso).'\'';
            }, $isoCandidates));

            $stateRow = Db::getInstance()->executeS('
                SELECT id_state FROM `'._DB_PREFIX_.'state`
                WHERE id_country = '.(int) $idCountryMx.'
                AND iso_code IN ('.$placeholders.')
                LIMIT 1
            ');
            $idState = $stateRow ? (int) $stateRow[0]['id_state'] : 0;
        }

        $colonias = array_values(array_unique(array_map(function ($row) {
            return $row['colonia'];
        }, $rows)));

        $this->ajaxDie(json_encode(array(
            'success' => true,
            'city' => $city,
            'id_state' => $idState,
            'colonias' => $colonias,
        )));
    }

    protected function tableExists($table)
    {
        $result = Db::getInstance()->executeS('SHOW TABLES LIKE \''.pSQL($table).'\'');

        return !empty($result);
    }
}
