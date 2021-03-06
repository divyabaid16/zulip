var server_events_dispatch = (function () {

var exports = {};

exports.dispatch_normal_event = function dispatch_normal_event(event) {
    var noop = function () {};
    switch (event.type) {
    case 'alert_words':
        alert_words.words = event.alert_words;
        alert_words_ui.render_alert_words_ui();
        break;

    case 'default_streams':
        stream_data.set_realm_default_streams(event.default_streams);
        settings_streams.update_default_streams_table();
        break;

    case 'hotspots':
        hotspots.load_new(event.hotspots);
        page_params.hotspots = page_params.hotspots ?
            page_params.hotspots.concat(event.hotspots) :
            event.hotspots;
        break;

    case 'muted_topics':
        muting_ui.handle_updates(event.muted_topics);
        break;

    case 'presence':
        activity.set_user_status(event.email, event.presence, event.server_timestamp);
        break;

    case 'restart':
        var reload_options = {save_pointer: true,
                              save_narrow: true,
                              save_compose: true,
                              message: "The application has been updated; reloading!",
                             };
        if (event.immediate) {
            reload_options.immediate = true;
        }
        reload.initiate(reload_options);
        break;

    case 'reaction':
        if (event.op === 'add') {
            reactions.add_reaction(event);
        } else if (event.op === 'remove') {
            reactions.remove_reaction(event);
        }
        break;

    case 'realm':
        var realm_settings = {
            add_emoji_by_admins_only: settings_emoji.update_custom_emoji_ui,
            allow_edit_history: noop,
            allow_message_deleting: noop,
            allow_message_editing: noop,
            bot_creation_policy: settings_bots.update_bot_permissions_ui,
            create_stream_by_admins_only: noop,
            default_language: settings_org.reset_realm_default_language,
            description: settings_org.update_realm_description,
            email_changes_disabled: settings_account.update_email_change_display,
            disallow_disposable_email_addresses: noop,
            inline_image_preview: noop,
            inline_url_embed_preview: noop,
            invite_by_admins_only: noop,
            invite_required: noop,
            mandatory_topics: noop,
            message_retention_days: settings_org.update_message_retention_days,
            name: notifications.redraw_title,
            name_changes_disabled: settings_account.update_name_change_display,
            notifications_stream_id: noop,
            send_welcome_emails: noop,
            signup_notifications_stream_id: noop,
            restricted_to_domain: noop,
            waiting_period_threshold: noop,
        };
        if (event.op === 'update' && _.has(realm_settings, event.property)) {
            page_params['realm_' + event.property] = event.value;
            realm_settings[event.property]();
            if (event.property === 'create_stream_by_admins_only') {
                if (!page_params.is_admin) {
                    page_params.can_create_streams = (!page_params.
                                                        realm_create_stream_by_admins_only);
                }
            } else if (event.property === 'notifications_stream_id') {
                settings_org.render_notifications_stream_ui(
                    page_params.realm_notifications_stream_id);
            } else if (event.property === 'signup_notifications_stream_id') {
                settings_org.render_signup_notifications_stream_ui(
                    page_params.realm_signup_notifications_stream_id);
            }

            if (event.property === 'name' && window.electron_bridge !== undefined) {
                window.electron_bridge.send_event('realm_name', event.value);
            }
        } else if (event.op === 'update_dict' && event.property === 'default') {
            _.each(event.data, function (value, key) {
                page_params['realm_' + key] = value;
                if (key === 'allow_message_editing') {
                    message_edit.update_message_topic_editing_pencil();
                }
            });
            if (event.data.authentication_methods !== undefined) {
                settings_org.populate_auth_methods(event.data.authentication_methods);
            }
        } else if (event.op === 'update_dict' && event.property === 'icon') {
            page_params.realm_icon_url = event.data.icon_url;
            page_params.realm_icon_source = event.data.icon_source;
            realm_icon.rerender();

            var electron_bridge = window.electron_bridge;
            if (electron_bridge !== undefined) {
                electron_bridge.send_event('realm_icon_url', event.data.icon_url);
            }
        } else if (event.op === 'deactivated') {
            window.location.href = "/accounts/deactivated/";
        }

        break;

    case 'realm_bot':
        if (event.op === 'add') {
            bot_data.add(event.bot);
            settings_users.update_user_data(event.bot.user_id, event.bot);
        } else if (event.op === 'remove') {
            bot_data.deactivate(event.bot.user_id);
            event.bot.is_active = false;
            settings_users.update_user_data(event.bot.user_id, event.bot);
        } else if (event.op === 'delete') {
            bot_data.delete(event.bot.user_id);
            settings_users.update_user_data(event.bot.user_id, event.bot);
        } else if (event.op === 'update') {
            if (_.has(event.bot, 'owner_id')) {
                event.bot.owner = people.get_person_from_user_id(event.bot.owner_id).email;
            }
            bot_data.update(event.bot.user_id, event.bot);
            settings_users.update_user_data(event.bot.user_id, event.bot);
        }
        break;

    case 'realm_emoji':
        // Update `page_params.realm_emoji` so that settings page
        // can display it properly when reopened without refresh.
        page_params.realm_emoji = event.realm_emoji;
        emoji.update_emojis(event.realm_emoji);
        settings_emoji.populate_emoji(event.realm_emoji);
        emoji_picker.generate_emoji_picker_data(emoji.active_realm_emojis);
        break;

    case 'realm_filters':
        page_params.realm_filters = event.realm_filters;
        markdown.set_realm_filters(page_params.realm_filters);
        settings_filters.populate_filters(page_params.realm_filters);
        break;

    case 'realm_domains':
        var i;
        if (event.op === 'add') {
            page_params.realm_domains.push(event.realm_domain);
        } else if (event.op === 'change') {
            for (i = 0; i < page_params.realm_domains.length; i += 1) {
                if (page_params.realm_domains[i].domain === event.realm_domain.domain) {
                    page_params.realm_domains[i].allow_subdomains =
                        event.realm_domain.allow_subdomains;
                    break;
                }
            }
        } else if (event.op === 'remove') {
            for (i = 0; i < page_params.realm_domains.length; i += 1) {
                if (page_params.realm_domains[i].domain === event.domain) {
                    page_params.realm_domains.splice(i, 1);
                    break;
                }
            }
        }
        settings_org.populate_realm_domains(page_params.realm_domains);
        break;

    case 'realm_user':
        if (event.op === 'add') {
            people.add_in_realm(event.person);
        } else if (event.op === 'remove') {
            people.deactivate(event.person);
        } else if (event.op === 'update') {
            user_events.update_person(event.person);
        }
        break;

    case 'stream':
        if (event.op === 'update') {
            // Legacy: Stream properties are still managed by subs.js on the client side.
            stream_events.update_property(
                event.stream_id,
                event.property,
                event.value
            );
            settings_streams.update_default_streams_table();
        } else if (event.op === 'create') {
            stream_data.create_streams(event.streams);
            _.each(event.streams, function (stream) {
                var sub = stream_data.get_sub_by_id(stream.stream_id);
                stream_data.update_calculated_fields(sub);
                subs.add_sub_to_table(sub);
            });
        } else if (event.op === 'delete') {
            _.each(event.streams, function (stream) {
                var was_subscribed = stream_data.get_sub_by_id(stream.stream_id).subscribed;
                stream_data.delete_sub(stream.stream_id);
                subs.remove_stream(stream.stream_id);
                if (was_subscribed) {
                    stream_list.remove_sidebar_row(stream.stream_id);
                }
                settings_streams.remove_default_stream(stream.stream_id);
                stream_data.remove_default_stream(stream.stream_id);
                if (page_params.realm_notifications_stream_id === stream.stream_id) {
                    page_params.realm_notifications_stream_id = -1;
                    settings_org.render_notifications_stream_ui(
                        page_params.realm_notifications_stream_id);
                }
                if (page_params.realm_signup_notifications_stream_id === stream.stream_id) {
                    page_params.realm_signup_notifications_stream_id = -1;
                    settings_org.render_signup_notifications_stream_ui(
                        page_params.realm_signup_notifications_stream_id);
                }
            });
        }
        break;

    case 'subscription':
        var person;
        var email;

        if (event.op === 'add') {
            _.each(event.subscriptions, function (rec) {
                var sub = stream_data.get_sub_by_id(rec.stream_id);
                if (sub) {
                    stream_events.mark_subscribed(sub, rec.subscribers);
                } else {
                    blueslip.error('Subscribing to unknown stream with ID ' + rec.stream_id);
                }
            });
        } else if (event.op === 'peer_add') {
            // TODO: remove email shim here and fix called functions
            //       to use user_ids
            person = people.get_person_from_user_id(event.user_id);
            email = person.email;
            _.each(event.subscriptions, function (sub) {
                if (stream_data.add_subscriber(sub, event.user_id)) {
                    $(document).trigger(
                        'peer_subscribe.zulip',
                        {stream_name: sub, user_email: email});
                } else {
                    blueslip.warn('Cannot process peer_add event');
                }
            });
        } else if (event.op === 'peer_remove') {
            // TODO: remove email shim here and fix called functions
            //       to use user_ids
            person = people.get_person_from_user_id(event.user_id);
            email = person.email;
            _.each(event.subscriptions, function (sub) {
                if (stream_data.remove_subscriber(sub, event.user_id)) {
                    $(document).trigger(
                        'peer_unsubscribe.zulip',
                        {stream_name: sub, user_email: email});
                } else {
                    blueslip.warn('Cannot process peer_remove event.');
                }
            });
        } else if (event.op === 'remove') {
            _.each(event.subscriptions, function (rec) {
                var sub = stream_data.get_sub_by_id(rec.stream_id);
                stream_events.mark_unsubscribed(sub);
            });
        } else if (event.op === 'update') {
            stream_events.update_property(
                event.stream_id,
                event.property,
                event.value
            );
        }
        break;

    case 'typing':
        if (event.sender.user_id === page_params.user_id) {
            // typing notifications are sent to the user who is typing
            // as well as recipients; we ignore such self-generated events.
            return;
        }

        if (event.op === 'start') {
            typing_events.display_notification(event);
        } else if (event.op === 'stop') {
            typing_events.hide_notification(event);
        }
        break;

    case 'update_display_settings':
        var user_display_settings = [
            'default_language',
            'emojiset',
            'high_contrast_mode',
            'night_mode',
            'left_side_userlist',
            'timezone',
            'twenty_four_hour_time',
            'translate_emoticons',
        ];
        if (_.contains(user_display_settings, event.setting_name)) {
            page_params[event.setting_name] = event.setting;
        }
        if (event.setting_name === 'default_language') {
            // We additionally need to set the language name.
            page_params.default_language_name = event.language_name;
        }
        if (event.setting_name === 'twenty_four_hour_time') {
            // Rerender the whole message list UI
            home_msg_list.rerender();
            if (current_msg_list === message_list.narrowed) {
                message_list.narrowed.rerender();
            }
        }
        if (event.setting_name === 'high_contrast_mode') {
            $("body").toggleClass("high-contrast");
        }
        if (event.setting_name === 'night_mode') {
            $("body").fadeOut(300);
            setTimeout(function () {
                if (event.setting === true) {
                    night_mode.enable();
                } else {
                    night_mode.disable();
                }
                $("body").fadeIn(300);
            }, 300);
        }
        if (event.setting_name === 'left_side_userlist') {
            // TODO: Make this change the view immediately rather
            // than requiring a reload or page resize.
        }
        if (event.setting_name === 'default_language') {
            // TODO: Make this change the view immediately rather
            // than requiring a reload or page resize.
        }
        if (event.setting_name === 'emojiset') {
            settings_display.report_emojiset_change();

            // Rerender the whole message list UI
            home_msg_list.rerender();
            if (current_msg_list === message_list.narrowed) {
                message_list.narrowed.rerender();
            }
        }
        settings_display.update_page();
        break;

    case 'update_global_notifications':
        notifications.handle_global_notification_updates(event.notification_name,
                                                         event.setting);
        settings_notifications.update_page();
        break;

    case 'update_message_flags':
        var new_value = event.operation === "add";
        switch (event.flag) {
        case 'starred':
            _.each(event.messages, function (message_id) {
                ui.update_starred(message_id, new_value);
            });
            break;
        case 'read':
            unread_ops.process_read_messages_event(event.messages);
            break;
        }
        break;

    case 'delete_message':
        var msg_id = event.message_id;
        var message = message_store.get(msg_id);
        // message is passed to unread.get_unread_messages,
        // which returns all the unread messages out of a given list.
        // So double marking something as read would not occur
        unread_ops.mark_message_as_read(message);
        if (message.type === 'stream') {
            topic_data.remove_message({
                stream_id: message.stream_id,
                topic_name: message.subject,
            });
            stream_list.update_streams_sidebar();
        }
        ui.remove_message(msg_id);
        break;

    case 'user_group':
        if (event.op === 'add') {
            user_groups.add(event.group);
        } else if (event.op === 'add_members') {
            user_groups.add_members(event.group_id, event.user_ids);
        } else if (event.op === 'remove_members') {
            user_groups.remove_members(event.group_id, event.user_ids);
        } else if (event.op === "update") {
            user_groups.update(event);
        }
        settings_user_groups.reload();
        break;
    }
};

return exports;

}());
if (typeof module !== 'undefined') {
    module.exports = server_events_dispatch;
}
