/**
 * Created by vlitvinov on 06.09.2018.
 */

function Greeter() {

    this.greet = (lang) => {
        switch (lang) {
            case "en": return "Hello!";
            case "fr": return "Bonjour!";
            case "it": return "Ciao!";
            case "gr": return "Halo!";
            default: "Don't speak that!";
        }
    }
}

exports.helloWorld = () => { //export functionality
  console.log("Hello world!!");
};

module.exports = Greeter; //export class
