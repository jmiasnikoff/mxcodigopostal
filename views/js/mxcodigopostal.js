(function ($) {
    'use strict';

    function debounce(fn, delay) {
        var timer = null;
        return function () {
            var context = this;
            var args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function () {
                fn.apply(context, args);
            }, delay);
        };
    }

    function fieldWrapper($field) {
        return $field.closest('.form-group.row');
    }

    // En el checkout de una página (ps_onepagecheckout) el formulario inline y los modales de
    // dirección están dentro del MISMO <form id="opc-form">, así que closest('form') alcanzaría
    // los campos de otras secciones. Se acota al contenedor propio del CP; en el formulario
    // clásico no hay ninguno de esos ids y el más cercano sigue siendo el <form>.
    function fieldsScope($postcode) {
        return $postcode.closest('#opc-delivery-address-fields, #modal-delivery, form');
    }

    // Lee las clases de grid (col-md-X) del propio campo Código Postal en vez de asumir
    // col-md-3/col-md-6: cada theme usa proporciones distintas (devstore: 3/6, boners: 2/10).
    function gridClasses($postcode) {
        var $label = fieldWrapper($postcode).find('label').first();
        var labelClass = ($label.attr('class') || 'col-md-3 form-control-label')
            .replace(/\brequired\b/g, '')
            .trim();
        var wrapperClass = $postcode.parent().attr('class') || 'col-md-6';

        return {label: labelClass, wrapper: wrapperClass};
    }

    // Algunos themes ya tienen un campo para colonia en el formulario de dirección — a veces
    // es un input name="colonia" real, a veces es el campo estándar "other"/address2
    // simplemente renombrado a "Colonia" en las traducciones del theme (caso boners.com.mx
    // en checkout). Por eso se busca por el TEXTO de la etiqueta, no por el name del input:
    // así se detecta el campo sin importar cómo se llame por debajo. Si existe, se reutiliza
    // en vez de crear uno duplicado.
    function findColoniaInput($postcode) {
        var $match = null;
        var $scope = fieldsScope($postcode);

        // Checkout de una página: el campo estándar "other" es siempre la colonia (el tema solo
        // lo rotula así), sin depender del texto traducido de la etiqueta.
        if (!$scope.is('form')) {
            $match = $scope.find('input[name="other"]').first();

            return $match.length ? $match : null;
        }

        // ORIGINAL: $postcode.closest('form').find('.form-group.row label').each(function () {
        $scope.find('.form-group.row label').each(function () {
            if ($(this).text().trim().toLowerCase() === 'colonia') {
                var $candidate = $(this).closest('.form-group.row').find('input[type="text"]').first();
                if ($candidate.length) {
                    $match = $candidate;
                    return false;
                }
            }
        });

        return $match;
    }

    // En algunos themes (boners.com.mx) el campo nativo Colonia aparece ANTES de Código
    // Postal en la plantilla, lo cual confunde porque el CP es el que debe llenarse primero.
    // Se reordena por JS (mover el .form-group.row del theme) en vez de tocar el .tpl del theme.
    function reorderColoniaField($postcode, $native) {
        var $nativeRow = $native.closest('.form-group.row');
        var $postcodeRow = fieldWrapper($postcode);

        // ORIGINAL: if ($nativeRow.length) { fieldWrapper($postcode).after($nativeRow); }
        // Se mueve solo si hace falta: el checkout de una página ya pinta Colonia justo después
        // del CP, y reinsertar un nodo que ya está bien dispara mutaciones y puede quitar el foco.
        if ($nativeRow.length && !$postcodeRow.next().is($nativeRow)) {
            $postcodeRow.after($nativeRow);
        }
    }

    function attachAutocomplete($input, colonias) {
        var $parent = $input.parent().addClass('mxcodigopostal-autocomplete');
        var $menu = $parent.find('.js-mxcodigopostal-menu');

        if (!$menu.length) {
            $menu = $('<div class="dropdown-menu js-mxcodigopostal-menu"></div>');
            $parent.append($menu);
        } else {
            $menu.removeClass('show').empty();
        }

        var activeIndex = -1;

        function renderMenu(filter) {
            var term = (filter || '').toLowerCase();
            var matches = colonias.filter(function (colonia) {
                return colonia.toLowerCase().indexOf(term) !== -1;
            });

            activeIndex = -1;
            $menu.empty();

            if (!matches.length) {
                $menu.removeClass('show');
                return;
            }

            matches.forEach(function (colonia) {
                $('<button type="button" class="dropdown-item"></button>')
                    .text(colonia)
                    // mousedown (no click) + preventDefault: evita que el navegador mueva el
                    // foco al botón. Si el input pierde el foco antes de $menu.empty(), quitar
                    // del DOM el elemento que tenía el foco dispara un salto de scroll.
                    .on('mousedown', function (e) {
                        e.preventDefault();
                        // ORIGINAL: $input.val(colonia); — sin evento el autosave del OPC no guarda la colonia elegida.
                        // El 'input' reabre el menú de forma síncrona y la línea siguiente lo cierra.
                        setField($input, colonia);
                        $menu.removeClass('show').empty();
                    })
                    .appendTo($menu);
            });

            $menu.addClass('show');
        }

        function highlightActive() {
            $menu.find('.dropdown-item').removeClass('active').eq(activeIndex).addClass('active');
        }

        // Namespace .mxcp: al volver a llamar attachAutocomplete (nuevo CP) se desatan solo
        // estos handlers, sin tocar otros que el theme ya tenga en el mismo input.
        $input.off('.mxcp');

        $input.on('focus.mxcp input.mxcp', function () {
            renderMenu($input.val());
        });

        $input.on('keydown.mxcp', function (e) {
            var $items = $menu.find('.dropdown-item');

            if (!$items.length) {
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = Math.min(activeIndex + 1, $items.length - 1);
                highlightActive();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = Math.max(activeIndex - 1, 0);
                highlightActive();
            } else if (e.key === 'Enter' && activeIndex >= 0) {
                e.preventDefault();
                // ORIGINAL: $input.val($items.eq(activeIndex).text()); (mismo motivo que en mousedown)
                setField($input, $items.eq(activeIndex).text());
                $menu.removeClass('show').empty();
            } else if (e.key === 'Escape') {
                $menu.removeClass('show');
            }
        });

        // El blur se retrasa para que el click en un item (que dispara blur primero) alcance a registrarse.
        $input.on('blur.mxcp', function () {
            setTimeout(function () {
                $menu.removeClass('show');
            }, 150);
        });
    }

    function buildColoniaField($postcode, colonias) {
        var $native = findColoniaInput($postcode);
        var $input;

        if ($native) {
            $input = $native;
            reorderColoniaField($postcode, $native);
        } else {
            fieldWrapper($postcode).nextAll('.js-mxcodigopostal-colonia').first().remove();
            $input = $('<input type="text" class="form-control" id="field-colonia" name="colonia" autocomplete="off">');

            var grid = gridClasses($postcode);
            var $wrapper = $('<div class="form-group row js-mxcodigopostal-colonia"></div>').append(
                $('<label for="field-colonia">Colonia</label>').addClass(grid.label),
                $('<div class="mxcodigopostal-autocomplete"></div>').addClass(grid.wrapper).append($input)
            );

            fieldWrapper($postcode).after($wrapper);
        }

        // Se limpia el valor anterior siempre: si el usuario ya tenía una colonia escrita (de
        // una dirección guardada o de un CP previo) y cambia el CP, ese valor viejo ya no
        // necesariamente corresponde al nuevo CP.
        // El valor se asigna ANTES de attachAutocomplete: su handler de 'input' abre el menú, y
        // el evento programático de setField no debe abrirlo (attachAutocomplete lo reinicia).
        // ORIGINAL: $input.val(colonias[0]); / $input.val('').attr(..) en cada rama
        if (colonias.length === 1) {
            setField($input, colonias[0]);
        } else if (colonias.length > 1) {
            setField($input, '');
            $input.attr('placeholder', 'Escribe o elige tu colonia');
        } else {
            setField($input, '');
            $input.attr('placeholder', 'Escribe la colonia');
        }

        attachAutocomplete($input, colonias);
    }

    // Rellena un campo y avisa con un evento DOM NATIVO (bubbles). El checkout de una página
    // se entera de los cambios por listeners delegados en body (autosave de la dirección) y por
    // addEventListener en #opc-form (validación); un .val() o un .trigger() de jQuery no llega
    // a estos últimos. El evento nativo sí llega también a los handlers jQuery y al formulario
    // clásico, donde es inofensivo.
    function setField($field, value) {
        $field.val(value).each(function () {
            this.dispatchEvent(new Event(this.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true}));
        });
    }

    function clearAddressFields($postcode) {
        // ORIGINAL: var $form = $postcode.closest('form'); y .val('') / .val('').trigger('change')
        var $scope = fieldsScope($postcode);

        setField($scope.find('[name="city"]'), '');
        setField($scope.find('[name="id_state"]'), '');

        buildColoniaField($postcode, []);
    }

    function handlePostcode($postcode) {
        var cp = ($postcode.val() || '').trim();

        if (!/^\d{5}$/.test(cp) || typeof mxcodigopostalAjaxUrl === 'undefined') {
            return;
        }

        $.get(mxcodigopostalAjaxUrl, {cp: cp}, function (response) {
            if (!response || !response.success) {
                clearAddressFields($postcode);
                return;
            }

            // ORIGINAL: var $form = $postcode.closest('form'); y $city.val(..) / $state.val(..).trigger('change')
            var $scope = fieldsScope($postcode);
            var $city = $scope.find('[name="city"]');
            var $state = $scope.find('[name="id_state"]');

            if ($city.length && response.city) {
                setField($city, response.city);
            }

            if ($state.length && response.id_state) {
                setField($state, response.id_state);
            }

            buildColoniaField($postcode, response.colonias || []);
        }, 'json').fail(function () {
            clearAddressFields($postcode);
        });
    }

    $(document).on('input', 'input[name="postcode"]', debounce(function () {
        handlePostcode($(this));
    }, 400));

    // El formulario de dirección se carga por AJAX (no está en el HTML inicial de la página).
    // Reordenar solo al hacer foco en Código Postal se ve como un salto raro, porque el
    // usuario ya vio el orden original del theme un instante antes de tocar el campo. Con un
    // MutationObserver se detecta el formulario apenas se inserta en el DOM y se reordena de
    // inmediato, antes de que el usuario llegue a verlo en el orden original.
    function initPostcodeField($postcode) {
        if ($postcode.data('mxcodigopostalInit')) {
            return;
        }

        $postcode.data('mxcodigopostalInit', true);

        var $native = findColoniaInput($postcode);
        if ($native) {
            reorderColoniaField($postcode, $native);
        }
    }

    function scanForPostcodeFields() {
        $('input[name="postcode"]').each(function () {
            initPostcodeField($(this));
        });
    }

    scanForPostcodeFields();

    new MutationObserver(scanForPostcodeFields).observe(document.body, {
        childList: true,
        subtree: true,
    });
})(jQuery);
