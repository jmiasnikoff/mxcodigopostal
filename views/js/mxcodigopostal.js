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

        $postcode.closest('form').find('.form-group.row label').each(function () {
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

        if ($nativeRow.length) {
            fieldWrapper($postcode).after($nativeRow);
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
                        $input.val(colonia);
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
                $input.val($items.eq(activeIndex).text());
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
        if (colonias.length === 1) {
            $input.val(colonias[0]);
        } else if (colonias.length > 1) {
            $input.val('').attr('placeholder', 'Escribe o elige tu colonia');
        } else {
            $input.val('').attr('placeholder', 'Escribe la colonia');
        }

        attachAutocomplete($input, colonias);
    }

    function clearAddressFields($postcode) {
        var $form = $postcode.closest('form');

        $form.find('[name="city"]').val('');
        $form.find('[name="id_state"]').val('').trigger('change');

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

            var $form = $postcode.closest('form');
            var $city = $form.find('[name="city"]');
            var $state = $form.find('[name="id_state"]');

            if ($city.length && response.city) {
                $city.val(response.city);
            }

            if ($state.length && response.id_state) {
                $state.val(response.id_state).trigger('change');
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
