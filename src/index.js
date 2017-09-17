'use strict';
var Alexa = require("alexa-sdk");
var request = require('sync-request');
var cheerio = require('cheerio');

var appId = ''; //'amzn1.echo-sdk-ams.app.your-skill-id';

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.appId = appId;
    alexa.registerHandlers(newSessionHandlers, getRecipeCandidateHandlers, getProcedureHandlers);
    alexa.execute();
};

var states = {
    RECIPECANDIDATEMODE: '_RECIPECANDIDATEMODE', // List recipe candidates for food ingredient provided by user
    PROCEDUREMODE: '_PROCEDUREMODE' // List procedure for a recipe
};

const QUREY_NUMBER = 5;

var recipe_urls = [];
var recipe_titles = [];
var recipe_ingredients = [];
var recipe_procedures = [];

var newSessionHandlers = {
    'NewSession': function() {

        recipe_urls = [];
        recipe_titles = [];
        recipe_ingredients = [];
        recipe_procedures = [];

        this.handler.state = states.RECIPECANDIDATEMODE;

        this.emit(':ask', 'Welcome to Freshly! We provide smart daily recipe for you. What is the main ingredient of dish you want to have today?');

    },
    "AMAZON.StopIntent": function() {
      this.emit(':tell', "Goodbye!");  
    },
    "AMAZON.CancelIntent": function() {
      this.emit(':tell', "Goodbye!");  
    },
    'SessionEndedRequest': function () {
        console.log('session ended!');

        this.emit(":tell", "Goodbye!");
    }
};

var getRecipeCandidateHandlers = Alexa.CreateStateHandler(states.RECIPECANDIDATEMODE, {
    'NewSession': function () {
        this.emit('NewSession'); // Uses the handler in newSessionHandlers
    },
    'FoodSearchIntent': function() {
        var foodName = String(this.event.request.intent.slots.food.value);
        getRecipe(foodName);

        var msg = 'For ' + foodName + ', we find following recipe. ';

        for(var i = 0; i < Math.min(recipe_titles.length, QUREY_NUMBER); ++i){
            msg += recipe_titles[i];

        }
        msg += 'Tell me the number associated with the recipe you want.';
        this.handler.state = states.PROCEDUREMODE;
        this.emit(':ask', msg);
    },
    'AMAZON.HelpIntent': function() {

        var message = 'Please provide a name of ingredient. For example, chicken.';
        this.emit(':ask', message, message);
    },

    "AMAZON.StopIntent": function() {
      console.log("STOPINTENT");
      this.emit(':tell', "Goodbye!");  
    },
    "AMAZON.CancelIntent": function() {
      console.log("CANCELINTENT");
      this.emit(':tell', "Goodbye!");  
    },
    'SessionEndedRequest': function () {
        console.log("SESSIONENDEDREQUEST");
        //this.attributes['endedSessionCount'] += 1;
        this.emit(':tell', "Goodbye!");
    },
    'Unhandled': function() {
        console.log("UNHANDLED");

        var message = 'Please provide a name of ingredient. For example, chicken.';
        this.emit(':ask', message, message);
    }
});

var getProcedureHandlers = Alexa.CreateStateHandler(states.PROCEDUREMODE, {
    'NewSession': function () {
        this.handler.state = '';
        this.emitWithState('NewSession'); // Equivalent to the Start Mode NewSession handler
    },
    'NumberChooseIntent': function() {
        var index = parseInt(this.event.request.intent.slots.number.value);
        if (index >= recipe_urls.length){
            this.emit(':ask', "There is no " + String(index) + " in options. Please give a valid number.");
        }
        else{
            getIngredientAndProcedure(recipe_urls[index]);
            var msg = "The ingredients you need are. ";

            for(var i = 0; i < recipe_ingredients.length; ++i){

                    msg += recipe_ingredients[i];

            }

            msg += "The procedures you need to follow are. ";
            for(var i = 0; i < recipe_procedures.length; ++i){

                    msg += recipe_procedures[i];

            } 
            this.emit(':tell', msg);
        }

    },
    'AMAZON.HelpIntent': function() {
        this.emit(':ask', 'I am thinking of a number between zero and one hundred, try to guess and I will tell you' +
            ' if it is higher or lower.', 'Try saying a number.');
    },
    "AMAZON.StopIntent": function() {
        console.log("STOPINTENT");
      this.emit(':tell', "Goodbye!");  
    },
    "AMAZON.CancelIntent": function() {
        console.log("CANCELINTENT");
    },
    'SessionEndedRequest': function () {
        console.log("SESSIONENDEDREQUEST");
        this.attributes['endedSessionCount'] += 1;
        this.emit(':tell', "Goodbye!");
    },
    'Unhandled': function() {
        console.log("UNHANDLED");
        this.emit(':ask', 'Sorry, I didn\'t get that. Try saying a number.', 'Try saying a number.');
    }
});
        


function getRecipe(keyword){

    var url = 'http://www.seriouseats.com/search?term=' + keyword + '&site=recipes';
    
    var res = request('GET', url);
    var content = res.body.toString('utf-8');

    extractRecipeInfo(content);

}


function extractRecipeInfo(response){

    var $ = cheerio.load(response);

    var block_wrappers = $('.block__wrapper');

    for(var i = 0; i < block_wrappers.length; ++i){

        var block_wrapper = block_wrappers[i];
        var module_links = $(block_wrapper).find($('.metadata')).find($('.module__link'));

        for(var j = 0; j < module_links.length; ++j){
            var module_link = module_links[j];
            var recipe_url = $(module_link).attr('href');
            var recipe_title = 'Choice ' + String(j) + '. ' + removeContentInsideBracket($(module_link).find($('.title')).text()) + '. ';

            recipe_urls.push(recipe_url);
            recipe_titles.push(recipe_title);
        }
        
    }

}    


function getIngredientAndProcedure(recipe_url){
    
    var res = request('GET', recipe_url);
    var content = res.body.toString('utf-8');

    extractIngredientAndProcedure(content);

}

function extractIngredientAndProcedure(response){

    extractIngredient(response);
    extractProcedure(response);

}


function extractIngredient(response){

    var $ = cheerio.load(response);
    var ingredients = $('.ingredient');

    for(var i = 0; i < ingredients.length; ++i){

        var ingredient = removeContentInsideBracket($(ingredients[i]).html()) + '. ';
        recipe_ingredients.push(ingredient);     

    }

}

function extractProcedure(response){

    var $ = cheerio.load(response);
    var procedures = $('.recipe-procedure-text');

    for(var i = 0; i < procedures.length; ++i){
        var procedure = 'Step ' + String(i+1) + '. ' + removeContentInsideBracket($(procedures[i]).html()) + ' ';
        recipe_procedures.push(procedure);
    }

}

function removeContentInsideBracket(text){
    text = text.replace(/ *\<[^>]*\> */g, "");
    text = text.replace(/ *\([^)]*\) */g, "");
    text = text.replace(/\t/g, " ");
    return text;
}
