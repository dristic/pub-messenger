$(document).ready(function () {
  ////
  // PubNub Decorator
  // -------------------
  // This wraps the pubnub libarary so we can handle the uuid and list
  // of subscribed channels.
  ////
  function PubNub() {
    this.publishKey = 'pub-c-40686ff2-11d5-4d8d-8617-79c293b550c7';
    this.subscribeKey = 'sub-c-3e046e97-b6aa-11e2-aa09-28cfe94b2603';
    this.subscriptions = localStorage["pn-subscriptions"] || [];

    if(typeof this.subscriptions == "string") {
      this.subscriptions = this.subscriptions.split(",");
    }
    this.subscriptions = $.unique(this.subscriptions);
  }

  PubNub.prototype.connect = function(username) {
    this.username = username;
    this.connection = PUBNUB.init({
      publish_key: this.publishKey,
      subscribe_key: this.subscribeKey,
      uuid: this.username
    });
  };

  PubNub.prototype.addSubscription = function(channel) {
    this.subscriptions.push(channel);
    this.subscriptions = $.unique(this.subscriptions);
  };

  PubNub.prototype.removeSubscription = function(channel) {
    if (this.subscriptions.indexOf(channel) !== -1) {
      this.subscriptions.splice(this.subscriptions.indexOf(channel), 1);
    }
    this.saveSubscriptions();
  };

  PubNub.prototype.saveSubscriptions = function() {
    localStorage["pn-subscriptions"] = this.subscriptions;
  };

  PubNub.prototype.subscribe = function(options) {
    this.connection.subscribe.apply(this.connection, arguments);
    this.addSubscription(options.channel);
    this.saveSubscriptions();
  };

  PubNub.prototype.publish = function() {
    this.connection.publish.apply(this.connection, arguments);
  };

  PubNub.prototype.history = function() {
    this.connection.history.apply(this.connection, arguments);
  };

  var chatChannel = '',
      username = '',
      users = [],
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
      pubnub = new PubNub(),
      pages = {
        home: $("#homePage"),
        chatList: $("#chatListPage"),
        chat: $("#chatPage"),
        delete: $("#delete")
      };

  ////////
  // Home View
  /////
  function HomeView() {
    if (localStorage["username"]) {
      usernameInput.val(localStorage["username"]);
    }

    chatButton.off('click');
    chatButton.click(function (event) {
      if(usernameInput.val() != '') {
        username = usernameInput.val();

        localStorage["username"] = username;

        pubnub.connect(username);

        $.mobile.changePage(pages.chatList);
      }
    });
  };

  /////
  // Chat List View
  ///////
  function ChatListView(event, data) {
    chatListEl.empty();
    for(var i = 0; i < pubnub.subscriptions.length; i++) {
      var chatName = pubnub.subscriptions[i],
          chatEl = $("<li><a href='#chatPage' data-channel-name='" + chatName + "'>" 
            + chatName 
            + "</a><a href='#delete' data-rel='dialog' data-channel-name='" + chatName + "'></a></li>");
      chatListEl.append(chatEl);
      chatListEl.listview('refresh');
    }

    newChatButton.off('click');
    newChatButton.click(function (event) {
      if(chatRoomName.val() !== '') {
        chatChannel = chatRoomName.val();

        $.mobile.changePage(pages.chat);
      }
    });
  };

  //////
  // Delete Chat View
  ///////
  function DeleteChatView(event, data) {
    if (data.options && data.options.link) {
      var channelName = data.options.link.attr('data-channel-name'),
          deleteButton = pages.delete.find("#deleteButton");

      deleteButton.unbind('click');
      deleteButton.click(function (event) {
        pubnub.removeSubscription(channelName);
        console.log(pages.delete.children());
        pages.delete.find('[data-rel="back"]').click();
      });
    }
  };

  /////
  // Chatting View
  //////
  function ChatView(event, data) {
    var self = this;

    if (data.options && data.options.link) {
      chatChannel = data.options.link.attr('data-channel-name');
    }

    users = [];
    messageList.empty();
    userList.empty();

    pubnub.subscribe({
      channel: chatChannel,
      message: self.handleMessage,
      presence   : function( message, env, channel ) {
        // console.log( "Channel: ",            channel           );
        // console.log( "Join/Leave/Timeout: ", message.action    );
        // console.log( "Occupancy: ",          message.occupancy );
        // console.log( "User ID: ",            message.uuid      );

        if (message.action == "join") {
          users.push(message.uuid);
          userList.append("<li>" + message.uuid + "</li>");
        } else {
          users.splice(users.indexOf(message.uuid), 1);
          userList.find('[data-username="' + message.uuid + '"]').remove();
        }

        userList.listview('refresh');
      }
    });

    // Handle chat history
    pubnub.history({
      channel: chatChannel,
      limit: 100
    }, function (messages) {
      messages = messages[0];
      messages = messages || [];

      for(var i = 0; i < messages.length; i++) {
        self.handleMessage(messages[i]);
      }
    });

    // Change the title to the chat channel.
    pages.chat.find("h1:first").text(chatChannel);

    messageContent.off('keydown');
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
  };

  // This handles appending new messages to our chat list.
  ChatView.prototype.handleMessage = function(message) {
    var messageEl = $("<li>"
        + "<span class='username'>" + message.username + ": </span>"
        + message.text
        + "</li>");
    messageList.append(messageEl);
    messageList.listview('refresh');
  };

  // Initially start off on the home page.
  $.mobile.changePage(pages.home);
  var currentView = new HomeView();

  // This code essentially does what routing does in Backbone.js.
  // It takes the page destination and creates a view based on what
  // page the user is navigating to.
  $(document).bind("pagechange", function (event, data) {
    if (data.toPage[0] == pages.chatList[0]) {
      currentView = new ChatListView(event, data);
    } else if (data.toPage[0] == pages.delete[0]) {
      currentView = new DeleteChatView(event, data);
    } else if (data.toPage[0] == pages.chat[0]) {
      currentView = new ChatView(event, data);
    }
  });
});