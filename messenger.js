$(document).ready(function () {
  var chatChannel = '',
      username = '',
      users = [],
      chats = localStorage["chats"] || [],
      usernameInput = $('#username'),
      chatRoomName = $("#chatRoomName"),
      chatButton = $("#startChatButton"),
      newChatButton = $("#newChatButton"),
      chatListEl = $("#chatList"),
      sendMessageButton = $("#sendMessageButton"),
      backButton = $("#backButton"),
      messageList = $("#messageList"),
      messageContent = $("#messageContent"),
      userList = $("#userList"),
      pubnub = null,
      pages = {
        home: $("#homePage"),
        chatList: $("#chatListPage"),
        chat: $("#chatPage"),
        delete: $("#delete")
      };

  // Fix local storage coming out as a string
  if(typeof chats == "string") {
    chats = chats.split(",");
  }
  chats = $.unique(chats);
  localStorage["chats"] = chats;

  $.mobile.changePage(pages.home);

  function connect(username) {
    if (pubnub === null) {
      pubnub = PUBNUB.init({
        publish_key: 'pub-c54880a5-ba99-4836-a084-08f57b4b5333',
        subscribe_key: 'sub-3129de73-8f26-11e1-94c8-1543525cae6d',
        uuid: username
      });
    }
  };

  // Handles adding messages to our list.
  function handleMessage(message) {
    var messageEl = $("<li>"
      + "<span class='username'>" + message.username + ": </span>"
      + message.text
      + "</li>");
    messageList.append(messageEl);
    messageList.listview('refresh');
  }

  chatButton.click(function (event) {
    if(usernameInput.val() != '') {
      username = usernameInput.val();

      $.mobile.changePage(pages.chatList);
    }
  });

  $(document).bind("pagechange", function (event, data) {
    if (data.toPage[0] == pages.chatList[0]) {
      chatListEl.empty();
      for(var i = 0; i < chats.length; i++) {
        var chatName = chats[i],
            chatEl = $("<li><a href='#chatPage' data-channel-name='" + chatName + "'>" 
              + chatName 
              + "</a><a href='#delete' data-rel='dialog' data-channel-name='" + chatName + "'></a></li>");
        chatListEl.append(chatEl);
        chatListEl.listview('refresh');
      }
    } else if (data.toPage[0] == pages.delete[0]) {
      if (data.options && data.options.link) {
        var channelName = data.options.link.attr('data-channel-name'),
            deleteButton = pages.delete.find("#deleteButton");

        deleteButton.unbind('click');
        deleteButton.click(function (event) {
          chats.splice(chats.indexOf(channelName), 1);
          localStorage["chats"] = chats;
          pages.delete.children('[data-rel="back"]').click();
        });
      }
    } else if (data.toPage[0] == pages.chat[0]) {
      if (data.options && data.options.link) {
        chatChannel = data.options.link.attr('data-channel-name');
      }

      users = [];
      messageList.empty();

      connect();

      pubnub.subscribe({
        channel: chatChannel,
        message: handleMessage,
        presence   : function( message, env, channel ) {
          // console.log( "Channel: ",            channel           );
          // console.log( "Join/Leave/Timeout: ", message.action    );
          // console.log( "Occupancy: ",          message.occupancy );
          // console.log( "User ID: ",            message.uuid      );

          if (message.action == "join") {
            users.push(message.uuid);
          } else {
            users.splice(users.indexOf(message.uuid), 1);
          }

          userList.text(users.join(", "));
        }
      });

      $(document).trigger('subscribed');

      // Change the title to the chat channel.
      pages.chat.find("h1:first").text("Pub Messenger - " + chatChannel);
    }
  });

  newChatButton.click(function (event) {
    if(chatRoomName.val() !== '') {
      chatChannel = chatRoomName.val();

      chats.push(chatChannel);
      localStorage["chats"] = chats;

      $.mobile.changePage(pages.chat);
    }
  });

  messageContent.bind('keydown', function (event) {
    if((event.keyCode || event.charCode) !== 13) return true;
    sendMessageButton.click();
    return false;
  });

  sendMessageButton.click(function (event) {
    var message = messageContent.val();

    if(message !== "") {
      pubnub.publish({
        channel: chatChannel,
        message: {
          username: username,
          text: message
        }
      });

      messageContent.val("");
    }
  });

  // backButton.click(function (event) {
  //   messageList.empty();
  //   $.mobile.changePage(pages.home);
  // });

  $(document).on('subscribed', function (event) {
    // Handle chat history
    pubnub.history({
      channel: chatChannel,
      limit: 100
    }, function (messages) {
      messages = messages[0];
      messages = messages || [];

      for(var i = 0; i < messages.length; i++) {
        handleMessage(messages[i]);
      }
    });

    // Handle presence
    // pubnub.presence({
    //   channel: chatChannel,
    //   callback: function (message) {
    //     console.log("Presence message: " + message);
    //   }
    // });
  });
});