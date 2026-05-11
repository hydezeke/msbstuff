const strings = {
  en: {
    // Nav
    'nav.listings':   'Listings',
    'nav.my_items':   'My Items',
    'nav.admin':      'Admin',
    'nav.login':      'Login',
    'nav.logout':     'Logout',

    // Browse page
    'browse.title':   'Listings',
    'browse.post_btn':'Post an Item',
    'browse.filter_all': 'All',
    'browse.empty':   'No listings yet. Be the first to post!',
    'browse.view':    'View',

    // Listing detail
    'listing.back':         '← All listings',
    'listing.posted_by':    'Posted by',
    'listing.contact_btn':  'Contact about this item',
    'listing.login_contact':'Login to contact',
    'listing.flag':         'Flag',
    'listing.flag_confirm': 'Flag this listing as inappropriate?',
    'listing.yours':        'This is your listing',
    'listing.not_found':    'Listing not found',
    'listing.back_to_all':  'Back to listings',

    // Post/create form
    'post.title':       'Post an Item',
    'post.label_title': 'Title',
    'post.label_tags':  'Tags',
    'post.tags_hint':   'Select any that apply.',
    'post.no_tags':     'No tags yet — an admin can create them at Admin → Tags.',
    'post.label_desc':  'Description',
    'post.label_photo': 'Photo (optional, max 5 MB)',
    'post.submit':      'Post Item',
    'post.cancel':      'Cancel',

    // Contact form
    'contact.heading':       'Contact about',
    'contact.back':          '← Back to listing',
    'contact.privacy_note':  'Your contact info will be sent to {user} and deleted after 7 days. It is never publicly displayed.',
    'contact.label_contact': 'Your email or phone number',
    'contact.hint_contact':  'How should {user} reach you?',
    'contact.label_message': 'Message (optional)',
    'contact.placeholder':   'Hi, I\'m interested in…',
    'contact.submit':        'Send',
    'contact.cancel':        'Cancel',

    // Login
    'login.title':    'Login',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.submit':   'Login',

    // Register
    'register.title':        'Join the Neighborhood',
    'register.intro':        'Choose a username (no real name needed).',
    'register.label_user':   'Username / Handle',
    'register.hint_user':    '2–30 characters. No real name required.',
    'register.label_pass':   'Password',
    'register.hint_pass':    'At least 8 characters.',
    'register.submit':       'Create Account',
    'register.invalid':      'Invalid or Expired Invite',
    'register.invalid_body': 'This invite link is invalid, has already been used, or has expired.',
    'register.browse':       'Browse listings',

    // Dashboard
    'dash.title':         'My Dashboard',
    'dash.my_listings':   'My Listings',
    'dash.post_new':      'Post new item',
    'dash.col_title':     'Title',
    'dash.col_tags':      'Tags',
    'dash.col_flags':     'Flags',
    'dash.delete':        'Delete',
    'dash.delete_confirm':'Delete this listing?',
    'dash.empty':         'You haven\'t posted anything yet.',
    'dash.post_link':     'Post an item!',
    'dash.contacts':      'Contact Requests for My Items',
    'dash.contacts_note': 'Contact info is automatically deleted after 7 days.',
    'dash.col_listing':   'Listing',
    'dash.col_their_contact': 'Their contact',
    'dash.col_message':   'Message',
    'dash.col_received':  'Received',
    'dash.no_contacts':   'No contact requests yet.',

    // Admin dashboard
    'admin.title':        'Admin Dashboard',
    'admin.manage_tags':  'Manage Tags',
    'admin.invite_links': 'Invite Links',
    'admin.flagged':      'Flagged Listings',
    'admin.no_flagged':   'No flagged listings.',
    'admin.col_posted_by':'Posted by',
    'admin.col_flags':    'Flags',
    'admin.col_actions':  'Actions',
    'admin.clear_flags':  'Clear flags',
    'admin.all_listings': 'All Listings (last 50)',
    'admin.no_listings':  'No listings yet.',
    'admin.neighbors':    'Neighbors',
    'admin.col_username': 'Username',
    'admin.col_role':     'Role',
    'admin.col_joined':   'Joined',
    'admin.role_admin':   'Admin',
    'admin.role_neighbor':'Neighbor',

    // Admin tags
    'tags.title':         'Manage Tags',
    'tags.back':          '← Admin',
    'tags.create':        'Create New Tag',
    'tags.label_name':    'Tag Name',
    'tags.placeholder':   'e.g. Free Stuff, Power Tools, Plants…',
    'tags.label_color':   'Color',
    'tags.color_hint':    'Pick a color for the tag pill',
    'tags.submit':        'Create Tag',
    'tags.all':           'All Tags',
    'tags.none':          'No tags yet.',
    'tags.col_tag':       'Tag',
    'tags.col_color':     'Color',
    'tags.col_used':      'Used on',
    'tags.col_created_by':'Created by',
    'tags.delete':        'Delete',
    'tags.delete_confirm':"Delete tag '{name}'? It will be removed from all listings.",

    // Admin invite
    'invite.title':       'Invite Tokens',
    'invite.back':        '← Admin',
    'invite.generate':    'Generate New Invite',
    'invite.label_expires':'Expires in (days, leave blank for no expiry)',
    'invite.submit':      'Generate Link',
    'invite.share':       'Share this link:',
    'invite.all':         'All Tokens',
    'invite.none':        'No tokens yet.',
    'invite.col_token':   'Token',
    'invite.col_created': 'Created by',
    'invite.col_used':    'Used by',
    'invite.col_expires': 'Expires',
    'invite.unused':      'unused',
    'invite.never':       'never',

    // Not found
    '404.title':          'Page not found',
    '404.home':           'Go home',

    // Time ago
    'time.just_now':  'just now',
    'time.minutes':   '{n}m ago',
    'time.hours':     '{n}h ago',
    'time.days':      '{n}d ago',

    // Misc UI
    'misc.no_tags':   'no tags',
    'misc.none':      'none',
    'misc.delete':    'Delete',
    'misc.delete_confirm': 'Delete listing?',

    // Flash messages
    'flash.item_posted':   'Your item has been posted!',
    'flash.flagged':       'Thanks — this listing has been flagged for review.',
    'flash.listing_deleted': 'Listing deleted.',
    'flash.flags_cleared': 'Flags cleared.',
    'flash.message_sent':  "Your message has been sent! They'll reach out using the contact info you provided.",
    'flash.tag_created':   "Tag '{name}' created.",
    'flash.tag_deleted':   "Tag '{name}' deleted.",
    'flash.lang_saved':    'Language preference saved.',
  },

  es: {
    // Nav
    'nav.listings':   'Anuncios',
    'nav.my_items':   'Mis Artículos',
    'nav.admin':      'Admin',
    'nav.login':      'Iniciar sesión',
    'nav.logout':     'Cerrar sesión',

    // Browse page
    'browse.title':   'Anuncios',
    'browse.post_btn':'Publicar un Artículo',
    'browse.filter_all': 'Todo',
    'browse.empty':   'Aún no hay anuncios. ¡Sé el primero en publicar!',
    'browse.view':    'Ver',

    // Listing detail
    'listing.back':         '← Todos los anuncios',
    'listing.posted_by':    'Publicado por',
    'listing.contact_btn':  'Contactar sobre este artículo',
    'listing.login_contact':'Inicia sesión para contactar',
    'listing.flag':         'Reportar',
    'listing.flag_confirm': '¿Reportar este anuncio como inapropiado?',
    'listing.yours':        'Este es tu anuncio',
    'listing.not_found':    'Anuncio no encontrado',
    'listing.back_to_all':  'Volver a anuncios',

    // Post/create form
    'post.title':       'Publicar un Artículo',
    'post.label_title': 'Título',
    'post.label_tags':  'Etiquetas',
    'post.tags_hint':   'Selecciona las que apliquen.',
    'post.no_tags':     'Aún no hay etiquetas — un admin puede crearlas en Admin → Etiquetas.',
    'post.label_desc':  'Descripción',
    'post.label_photo': 'Foto (opcional, máx. 5 MB)',
    'post.submit':      'Publicar',
    'post.cancel':      'Cancelar',

    // Contact form
    'contact.heading':       'Contactar sobre',
    'contact.back':          '← Volver al anuncio',
    'contact.privacy_note':  'Tu información de contacto será enviada a {user} y eliminada después de 7 días. Nunca se muestra públicamente.',
    'contact.label_contact': 'Tu correo o número de teléfono',
    'contact.hint_contact':  '¿Cómo puede {user} contactarte?',
    'contact.label_message': 'Mensaje (opcional)',
    'contact.placeholder':   'Hola, estoy interesado/a en…',
    'contact.submit':        'Enviar',
    'contact.cancel':        'Cancelar',

    // Login
    'login.title':    'Iniciar sesión',
    'login.username': 'Nombre de usuario',
    'login.password': 'Contraseña',
    'login.submit':   'Iniciar sesión',

    // Register
    'register.title':        'Únete al Vecindario',
    'register.intro':        'Elige un nombre de usuario (no se necesita nombre real).',
    'register.label_user':   'Usuario / Apodo',
    'register.hint_user':    '2–30 caracteres. No se requiere nombre real.',
    'register.label_pass':   'Contraseña',
    'register.hint_pass':    'Al menos 8 caracteres.',
    'register.submit':       'Crear cuenta',
    'register.invalid':      'Invitación inválida o expirada',
    'register.invalid_body': 'Este enlace de invitación es inválido, ya fue usado o expiró.',
    'register.browse':       'Ver anuncios',

    // Dashboard
    'dash.title':         'Mi Panel',
    'dash.my_listings':   'Mis Anuncios',
    'dash.post_new':      'Publicar nuevo artículo',
    'dash.col_title':     'Título',
    'dash.col_tags':      'Etiquetas',
    'dash.col_flags':     'Reportes',
    'dash.delete':        'Eliminar',
    'dash.delete_confirm':'¿Eliminar este anuncio?',
    'dash.empty':         'Aún no has publicado nada.',
    'dash.post_link':     '¡Publica un artículo!',
    'dash.contacts':      'Solicitudes de Contacto',
    'dash.contacts_note': 'La información de contacto se elimina automáticamente después de 7 días.',
    'dash.col_listing':   'Anuncio',
    'dash.col_their_contact': 'Su contacto',
    'dash.col_message':   'Mensaje',
    'dash.col_received':  'Recibido',
    'dash.no_contacts':   'Aún no hay solicitudes de contacto.',

    // Admin dashboard
    'admin.title':        'Panel de Administración',
    'admin.manage_tags':  'Gestionar Etiquetas',
    'admin.invite_links': 'Invitaciones',
    'admin.flagged':      'Anuncios Reportados',
    'admin.no_flagged':   'No hay anuncios reportados.',
    'admin.col_posted_by':'Publicado por',
    'admin.col_flags':    'Reportes',
    'admin.col_actions':  'Acciones',
    'admin.clear_flags':  'Limpiar reportes',
    'admin.all_listings': 'Todos los Anuncios (últimos 50)',
    'admin.no_listings':  'Aún no hay anuncios.',
    'admin.neighbors':    'Vecinos',
    'admin.col_username': 'Usuario',
    'admin.col_role':     'Rol',
    'admin.col_joined':   'Se unió',
    'admin.role_admin':   'Admin',
    'admin.role_neighbor':'Vecino',

    // Admin tags
    'tags.title':         'Gestionar Etiquetas',
    'tags.back':          '← Admin',
    'tags.create':        'Crear Nueva Etiqueta',
    'tags.label_name':    'Nombre de etiqueta',
    'tags.placeholder':   'ej. Cosas Gratis, Herramientas, Plantas…',
    'tags.label_color':   'Color',
    'tags.color_hint':    'Elige un color para la etiqueta',
    'tags.submit':        'Crear Etiqueta',
    'tags.all':           'Todas las Etiquetas',
    'tags.none':          'Aún no hay etiquetas.',
    'tags.col_tag':       'Etiqueta',
    'tags.col_color':     'Color',
    'tags.col_used':      'Usado en',
    'tags.col_created_by':'Creado por',
    'tags.delete':        'Eliminar',
    'tags.delete_confirm':"¿Eliminar la etiqueta '{name}'? Se quitará de todos los anuncios.",

    // Admin invite
    'invite.title':       'Invitaciones',
    'invite.back':        '← Admin',
    'invite.generate':    'Generar Nueva Invitación',
    'invite.label_expires':'Expira en días (vacío = sin expiración)',
    'invite.submit':      'Generar Enlace',
    'invite.share':       'Comparte este enlace:',
    'invite.all':         'Todas las Invitaciones',
    'invite.none':        'Aún no hay invitaciones.',
    'invite.col_token':   'Token',
    'invite.col_created': 'Creado por',
    'invite.col_used':    'Usado por',
    'invite.col_expires': 'Expira',
    'invite.unused':      'sin usar',
    'invite.never':       'nunca',

    // Not found
    '404.title':          'Página no encontrada',
    '404.home':           'Ir al inicio',

    // Time ago
    'time.just_now':  'ahora mismo',
    'time.minutes':   'hace {n}m',
    'time.hours':     'hace {n}h',
    'time.days':      'hace {n}d',

    // Misc UI
    'misc.no_tags':   'sin etiquetas',
    'misc.none':      'ninguno',
    'misc.delete':    'Eliminar',
    'misc.delete_confirm': '¿Eliminar anuncio?',

    // Flash messages
    'flash.item_posted':   '¡Tu artículo ha sido publicado!',
    'flash.flagged':       'Gracias — este anuncio ha sido reportado para revisión.',
    'flash.listing_deleted': 'Anuncio eliminado.',
    'flash.flags_cleared': 'Reportes eliminados.',
    'flash.message_sent':  '¡Tu mensaje fue enviado! Te contactarán con la información que proporcionaste.',
    'flash.tag_created':   "Etiqueta '{name}' creada.",
    'flash.tag_deleted':   "Etiqueta '{name}' eliminada.",
    'flash.lang_saved':    'Preferencia de idioma guardada.',
  },
};

// Translate a key, with optional {param} interpolation
function t(key, lang, params) {
  const l = (lang && strings[lang]) ? lang : 'en';
  const str = strings[l][key] || strings.en[key] || key;
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
}

module.exports = { t, strings };
